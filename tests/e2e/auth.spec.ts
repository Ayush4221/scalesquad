import { test, expect, repair, lobby } from './fixtures';
import { localBaseURL } from './settings';
import { randomBytes } from 'node:crypto';
test('guest redirects, private APIs reject guests, bad Origin is refused', async ({
  page,
  request,
}) => {
  await page.goto('/play');
  await expect(page).toHaveURL(/\/signin/);
  for (const path of ['/me', '/matches/unknown/evidence', '/push/key'])
    expect((await request.get(`/api/game${path}`)).status()).toBe(401);
  expect(
    (
      await request.post('/api/game/auth/login', {
        data: { email: 'nobody@example.invalid', password: 'not a real credential' },
        headers: { Origin: 'https://evil.example' },
      })
    ).status(),
  ).toBe(403);
});
test('unknown password login stays generic and supports keyboard submit', async ({ squad: s }) => {
  const page = s.outsider.page;
  await page.context().clearCookies();
  await page.goto('/signin');
  await page.getByLabel('Email', { exact: true }).fill(`${s.prefix}_missing@example.invalid`);
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('disposable invalid passphrase');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await password.press('Enter');
  await expect(page.locator('.error[role="alert"]')).toContainText(
    'Could not sign in with those details',
  );
});
test('logout closes the open socket, clears the session and rejects a new socket', async ({
  squad: s,
}) => {
  const host = s.players[0];
  let socket: import('@playwright/test').WebSocket | undefined;
  host.page.on('websocket', (ws) => {
    if (ws.url().endsWith('/ws')) socket = ws;
  });
  await repair(s);
  const closed = socket!.waitForEvent('close');
  expect((await s.post(host, '/auth/logout')).ok()).toBe(true);
  await closed;
  await host.page.goto('/play');
  await expect(host.page).toHaveURL(/\/signin/);
  const result = await host.page.evaluate(
    async (url) =>
      new Promise<string>((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.close();
          resolve('accepted');
        };
        ws.onerror = () => resolve('rejected');
      }),
    `${localBaseURL.replace('http', 'ws')}/ws`,
  );
  expect(result).toBe('rejected');
});
test('three signed-in players create and join without email verification', async ({ squad: s }) => {
  await lobby(s);
  const users = await s.db.user.findMany({
    where: { id: { in: s.players.map((player) => player.id) } },
  });
  expect(users.every((user) => user.emailVerified === null)).toBe(true);
  await expect(s.players[0].page.locator('.roster li')).toHaveCount(3);
});

test('email verification and recovery pages and endpoints are removed', async ({ squad: s }) => {
  for (const path of ['/verify', '/resend-verification', '/forgot-password', '/reset-password'])
    expect((await s.outsider.context.request.get(path)).status()).toBe(404);
  for (const route of ['verify', 'resend', 'forgot', 'reset'])
    expect((await s.post(s.outsider, `/auth/${route}`, {})).status()).toBe(404);
});

test('password signup, immediate sign-in, change, old-password rejection and logout-all', async ({
  squad: s,
}) => {
  const page = s.outsider.page;
  const email = `${s.prefix}_signup@example.invalid`;
  const password = `River ${randomBytes(12).toString('hex')} lanterns`;
  const nextPassword = `Forest ${randomBytes(12).toString('hex')} planets`;
  async function fillLogin(value: string) {
    await page.goto('/signin');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await page.context().clearCookies();
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Disposable Signup');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('You can sign in now');
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  const user = await s.db.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).toBeNull();
  expect(await s.db.emailToken.count({ where: { userId: user.id } })).toBe(0);
  await fillLogin(password);
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole('button', { name: 'Create squad' })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill(password);
  await page.getByLabel('New password', { exact: true }).fill(nextPassword);
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Account settings' }).getByRole('status'),
  ).toContainText('Password changed');
  await page.getByRole('button', { name: 'Sign out everywhere', exact: true }).click();
  await expect(page).toHaveURL(/\/signin/);
  await fillLogin(password);
  await expect(page.locator('.error[role="alert"]')).toContainText(
    'Could not sign in with those details',
  );
  await fillLogin(nextPassword);
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/signin/);
});
