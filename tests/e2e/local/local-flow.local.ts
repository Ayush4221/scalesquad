import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { ScryptPasswordHasher } from '../../../src/server/services/passwordService';

/**
 * End-to-end smoke test of the developer's local stack: real server, real `.env`,
 * real database. Three users sign up through the UI, sign in, form a squad,
 * start a match and use the Squad Desk chat. Only users created by this run
 * (emails starting with the run prefix) are deleted afterwards.
 * Set E2E_LOCAL_KEEP=1 to keep them for manual inspection.
 */
test.describe.configure({ mode: 'serial' });

interface User {
  role: 'host' | 'player2' | 'player3';
  name: string;
  email: string;
  password: string;
  context: BrowserContext;
  page: Page;
  id?: string;
}

const run = randomBytes(4).toString('hex');
const prefix = `e2e-local-${run}`;
// Satisfies the password policy: 8–128 chars, upper case, number, symbol,
// not a common password and not containing the email name.
const password = () => `Squad!${randomBytes(6).toString('base64url')}9Q`;

let db: PrismaClient;
let users: User[] = [];
let matchId = '';
let joinCode = '';
let baseURL = '';

const origin = () => ({ Origin: baseURL });
const host = () => users[0]!;

async function newUser(browser: Browser, role: User['role'], label: string): Promise<User> {
  const context = await browser.newContext({ baseURL });
  return {
    role,
    name: `${label} ${run}`,
    email: `${prefix}-${role}@example.invalid`,
    password: password(),
    context,
    page: await context.newPage(),
  };
}

async function signIn(user: User, secret = user.password) {
  const page = user.page;
  await page.goto('/signin');
  await page.getByLabel('Email address', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function selectTab(page: Page, tab: string) {
  const nav = page.getByRole('navigation', { name: 'Match sections' });
  if (await nav.isVisible()) await nav.getByRole('button', { name: tab, exact: true }).click();
}

test.beforeAll(async ({ browser }, info) => {
  baseURL = String(info.project.use.baseURL);
  db = new PrismaClient();
  users = [
    await newUser(browser, 'host', 'Host'),
    await newUser(browser, 'player2', 'Player Two'),
    await newUser(browser, 'player3', 'Player Three'),
  ];
});

test.afterAll(async () => {
  for (const user of users) await user.context.close();
  if (!db) return;
  if (process.env.E2E_LOCAL_KEEP !== '1') {
    const owned = await db.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = owned.map((u) => u.id);
    if (ids.length) {
      await db.match.deleteMany({ where: { hostUserId: { in: ids } } });
      await db.authEvent.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
  }
  await db.$disconnect();
});

test('server is healthy and the local database is connected and migrated', async ({ request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });

  // One query per migration era proves the schema is current, not just reachable.
  await expect(db.user.count()).resolves.toBeGreaterThanOrEqual(0);
  await expect(db.authEvent.count()).resolves.toBeGreaterThanOrEqual(0);
  await expect(db.pushSubscription.count()).resolves.toBeGreaterThanOrEqual(0);
  // Fails if the latest migration (match scenario column) is not applied.
  await db.match.findFirst({ select: { scenarioId: true } });

  // Guests are refused by the API and redirected by pages.
  expect((await request.get('/api/game/me')).status()).toBe(401);
});

test('three users sign up through the registration page', async () => {
  // The server allows 5 sign-ups per hour per IP. When that limit is reached the
  // remaining users are created with the app's own hasher so the rest of the
  // suite still runs; the skipped sign-ups are reported as an annotation.
  const limited: string[] = [];
  for (const user of users) {
    const page = user.page;
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByLabel('Full name', { exact: true }).fill(user.name);
    await page.getByLabel('Email address', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    const response = page.waitForResponse((r) => r.url().endsWith('/api/game/auth/register'));
    await page.getByRole('button', { name: 'Create account' }).click();
    const status = (await response).status();
    if (status === 429) {
      limited.push(user.role);
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
      await db.user.create({
        data: {
          email: user.email,
          name: user.name,
          passwordHash: await new ScryptPasswordHasher().hash(user.password),
        },
      });
    } else {
      expect(status, 'unexpected registration response').toBe(200);
      await expect(
        page.getByRole('status').filter({ hasText: 'You’re ready to sign in.' }),
      ).toBeVisible();
    }

    const row = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true, name: true, passwordHash: true },
    });
    expect(row?.name).toBe(user.name);
    expect(row?.passwordHash).toMatch(/^\$scrypt\$/);
    expect(row?.passwordHash).not.toContain(user.password);
    user.id = row!.id;
  }
  // Signing up never creates a session on its own.
  expect(await db.session.count({ where: { userId: { in: users.map((u) => u.id!) } } })).toBe(0);
  if (limited.length)
    test.info().annotations.push({
      type: 'sign-up rate limited',
      description: `Server returned 429 for ${limited.join(', ')}; created in the DB instead. Wait up to an hour or restart the dev server to cover UI sign-up for all three.`,
    });
});

test('sign-in flow: generic failure, success, sign-out and sign back in', async () => {
  const user = host();
  // Wrong password is rejected with a generic message and no session.
  await signIn(user, 'Wrong!Password42');
  await expect(user.page.getByRole('main').getByRole('alert')).toContainText(
    'Could not sign in with those details',
  );
  await expect(user.page).toHaveURL(/\/signin/);

  // Every user signs in and lands on /play with an authenticated session.
  for (const u of users) {
    await signIn(u);
    await expect(u.page).toHaveURL(/\/play/);
    const me = await u.context.request.get('/api/game/me');
    expect(me.ok()).toBe(true);
    expect(await me.json()).toMatchObject({ userId: u.id, name: u.name });
  }
  const cookies = await user.context.cookies();
  const session = cookies.find((c) => c.name.endsWith('authjs.session-token'));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');

  // Sign out removes the session server side, then sign back in.
  await user.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(user.page).toHaveURL(/\/signin/);
  expect((await user.context.request.get('/api/game/me')).status()).toBe(401);
  await signIn(user);
  await expect(user.page).toHaveURL(/\/play/);
});

test('squad flow: create, join by code, ready, start and private roles', async () => {
  const [hostUser, ...others] = users;
  await hostUser!.page.goto('/play');
  await hostUser!.page.getByRole('button', { name: 'Create squad' }).click();
  await expect(hostUser!.page).toHaveURL(/\/match\//);
  matchId = new URL(hostUser!.page.url()).pathname.split('/')[2]!;

  const view = (await (
    await hostUser!.context.request.get(`/api/game/matches/${matchId}`)
  ).json()) as { joinCode: string; members: unknown[]; hostUserId: string };
  joinCode = view.joinCode;
  expect(joinCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(view.hostUserId).toBe(hostUser!.id);

  // A wrong code is refused before anyone joins.
  await others[0]!.page.goto('/play');
  await others[0]!.page.getByRole('textbox', { name: 'Join code' }).fill('ZZZZZZZZ');
  await others[0]!.page.getByRole('button', { name: 'Join', exact: true }).click();
  // Scope to main: Next.js also renders an (empty) route-announcer alert.
  await expect(others[0]!.page.getByRole('main').getByRole('alert')).toContainText(
    'Invalid join code',
  );

  for (const player of others) {
    await player.page.goto('/play');
    await player.page.getByRole('textbox', { name: 'Join code' }).fill(joinCode);
    await player.page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(player.page).toHaveURL(new RegExp(matchId));
  }
  for (const u of users)
    await expect(u.page.getByRole('list', { name: 'Joined engineers' }).locator('li')).toHaveCount(
      3,
    );

  // Only the host can start, and only once all three are ready.
  const start = hostUser!.page.getByRole('button', { name: 'Start match' });
  await expect(start).toBeDisabled();
  await expect(others[0]!.page.getByRole('button', { name: 'Start match' })).toHaveCount(0);
  for (const u of users) {
    await selectTab(u.page, 'Squad');
    await u.page.getByRole('button', { name: 'Ready up', exact: true }).click();
    await expect(u.page.getByRole('button', { name: 'Not ready', exact: true })).toBeVisible();
  }
  await expect(start).toBeEnabled();
  await start.click();
  for (const u of users) await expect(u.page.locator('.status-bar')).toContainText('BRIEFING');

  // Each player gets a distinct role and only their own private evidence.
  const roles = new Set<string>();
  for (const u of users) {
    const own = (await (await u.context.request.get(`/api/game/matches/${matchId}`)).json()) as {
      ownRole: string;
    };
    roles.add(own.ownRole);
    await expect(u.page.getByText(`${own.ownRole} ENGINEER`)).toBeVisible();
    const cards = (await (
      await u.context.request.get(`/api/game/matches/${matchId}/evidence`)
    ).json()) as { role: string }[];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.role === own.ownRole)).toBe(true);
  }
  expect(roles).toEqual(new Set(['TRAFFIC', 'DATA', 'OPS']));

  // The join code no longer works once the match has started.
  const late = await users[1]!.context.request.post('/api/game/matches/join', {
    data: { code: joinCode },
    headers: origin(),
  });
  expect(late.ok()).toBe(false);
});

test('Squad Desk chat: members, clues, and live messages when Nexconn is configured', async () => {
  const view = (await (
    await host().context.request.get(`/api/game/matches/${matchId}`)
  ).json()) as {
    chatAvailable: boolean;
  };
  for (const u of users) {
    const desk = u.page.locator('.chat-card');
    await selectTab(u.page, 'Chat');
    await expect(desk.getByRole('list', { name: 'Squad members' }).locator('li')).toHaveCount(3);
    // Private clues are listed only for their owner.
    await desk.getByRole('button', { name: 'My clues', exact: true }).click();
    await expect(desk.getByRole('button', { name: 'Add to draft' }).first()).toBeVisible();
    await desk.getByRole('button', { name: 'Squad channel', exact: true }).click();
  }

  const hostDesk = host().page.locator('.chat-card');
  const status = hostDesk.getByRole('status').first();
  if (!view.chatAvailable) {
    test.info().annotations.push({
      type: 'chat',
      description: 'Nexconn is not configured in .env; checked the degraded mode only.',
    });
    await expect(status).toContainText('Chat unavailable. You can still play.');
    await expect(hostDesk.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    return;
  }

  // Real Nexconn: the token endpoint is member-only and messages reach everyone.
  const token = await host().context.request.post('/api/game/nexconn/token', {
    data: { matchId },
    headers: origin(),
  });
  expect(token.ok()).toBe(true);
  for (const u of users)
    await expect(u.page.locator('.chat-card').getByRole('status').first()).toContainText(
      'Connected',
      { timeout: 30000 },
    );
  const text = `Traffic peak check ${run}`;
  const input = host().page.getByRole('textbox', { name: 'Message your squad' });
  await input.fill(text);
  await hostDesk.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(input).toHaveValue('');
  for (const u of users)
    await expect(
      u.page.getByRole('log', { name: 'Squad messages' }).getByText(text, { exact: true }),
    ).toBeVisible({ timeout: 30000 });

  // Reply from another player is seen by the host.
  const reply = `Data says atomic is off ${run}`;
  const p2 = users[1]!;
  await p2.page.getByRole('textbox', { name: 'Message your squad' }).fill(reply);
  await p2.page.locator('.chat-card').getByRole('button', { name: 'Send', exact: true }).click();
  await expect(
    host().page.getByRole('log', { name: 'Squad messages' }).getByText(reply, { exact: true }),
  ).toBeVisible({ timeout: 30000 });
});

test('outsiders and stale sessions are refused', async ({ browser }) => {
  // A fresh, signed-out context cannot read the match or its evidence.
  const guest = await browser.newContext({ baseURL });
  expect((await guest.request.get(`/api/game/matches/${matchId}`)).status()).toBe(401);
  expect((await guest.request.get(`/api/game/matches/${matchId}/evidence`)).status()).toBe(401);
  await guest.close();

  // State-changing calls from a foreign origin are rejected even with a valid session.
  const forged = await host().context.request.post(`/api/game/matches/${matchId}/acknowledge`, {
    data: {},
    headers: { Origin: 'https://evil.example' },
  });
  expect(forged.status()).toBe(403);

  // Logging out kills the session for API calls.
  const out = await users[2]!.context.request.post('/api/game/auth/logout', {
    data: {},
    headers: origin(),
  });
  expect(out.ok()).toBe(true);
  expect((await users[2]!.context.request.get('/api/game/me')).status()).toBe(401);
});
