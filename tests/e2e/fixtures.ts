import { test as base, expect, devices, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertTestDatabase, localBaseURL } from './settings';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigurationValues } from '../../src/shared/domain';
export interface Player {
  id: string;
  name: string;
  context: BrowserContext;
  page: Page;
  token: string;
}
export interface Squad {
  players: [Player, Player, Player];
  outsider: Player;
  db: PrismaClient;
  prefix: string;
  matchId: string;
  post: (
    player: Player,
    path: string,
    body?: unknown,
  ) => Promise<import('@playwright/test').APIResponse>;
}
export const test = base.extend<{ squad: Squad }>({
  squad: async ({ browser }, use, testInfo) => {
    const db = new PrismaClient({ datasources: { db: { url: assertTestDatabase() } } }),
      prefix = `e2e${randomUUID().replaceAll('-', '')}`,
      players: Player[] = [];
    try {
      for (const [index, role] of ['Host', 'Player Two', 'Player Three', 'Outsider'].entries()) {
        const id = `${prefix}_${index}`,
          name = `${role} ${prefix.slice(-6)}`,
          token = randomBytes(32).toString('base64url');
        await db.user.create({
          data: { id, name, email: `${id}@example.invalid` },
        });
        await db.session.create({
          data: { userId: id, sessionToken: token, expires: new Date(Date.now() + 3600000) },
        });
        const profile =
          testInfo.project.name === 'mobile-ios'
            ? 'iPhone 13'
            : testInfo.project.name === 'mobile-android'
              ? 'Pixel 7'
              : 'Desktop Chrome';
        const address = randomBytes(2);
        const context = await browser.newContext({
          ...devices[profile],
          baseURL: localBaseURL,
          // Worker fetches bypass route interception. Exercise the real worker in its own spec.
          serviceWorkers: testInfo.file.endsWith('pwa.spec.ts') ? 'allow' : 'block',
          extraHTTPHeaders: { 'X-Forwarded-For': `198.18.${address[0]}.${address[1]}` },
        });
        await context.addCookies([
          {
            name: 'authjs.session-token',
            value: token,
            url: localBaseURL,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        // Third-party chat is isolated; live Nexconn delivery is not represented by this suite.
        await context.route('**/*', (route) =>
          new URL(route.request().url()).origin === localBaseURL ? route.continue() : route.abort(),
        );
        await context.routeWebSocket(/wss:\/\/.*/, (socket) => socket.close());
        players.push({ id, name, token, context, page: await context.newPage() });
      }
      const squad: Squad = {
        db,
        prefix,
        players: players.slice(0, 3) as Squad['players'],
        outsider: players[3]!,
        matchId: '',
        post: (player, path, body = {}) =>
          player.context.request.post(`/api/game${path}`, {
            data: body,
            headers: { Origin: localBaseURL },
          }),
      };
      await use(squad);
    } finally {
      for (const p of players) await p.context.close();
      const owned = await db.user.findMany({
          where: { OR: [{ id: { startsWith: prefix } }, { email: { startsWith: prefix } }] },
          select: { id: true },
        }),
        ids = owned.map((u) => u.id);
      await db.match.deleteMany({ where: { hostUserId: { in: ids } } });
      await db.authEvent.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  },
});
export { expect };
export async function selectTab(page: Page, tab: string) {
  const nav = page.getByRole('navigation', { name: 'Match sections' });
  if (await nav.isVisible()) await nav.getByRole('button', { name: tab, exact: true }).click();
}
export async function lobby(s: Squad) {
  const [host, ...others] = s.players;
  await host.page.goto('/play');
  await host.page.getByRole('button', { name: 'Create squad' }).click();
  await expect(host.page).toHaveURL(/\/match\//);
  s.matchId = new URL(host.page.url()).pathname.split('/')[2]!;
  const view = (await (
    await host.context.request.get(`/api/game/matches/${s.matchId}`)
  ).json()) as { joinCode: string };
  for (const player of others) {
    await player.page.goto('/play');
    await player.page.getByRole('textbox', { name: 'Join code' }).fill(view.joinCode);
    await player.page.getByRole('button', { name: 'Join', exact: false }).click();
    await expect(player.page).toHaveURL(new RegExp(s.matchId));
  }
  await expect(host.page.locator('.roster li')).toHaveCount(3);
}
export async function briefing(s: Squad) {
  await lobby(s);
  for (const p of s.players) {
    await selectTab(p.page, 'Squad');
    await p.page.getByRole('button', { name: 'Ready up', exact: true }).click();
  }
  await s.players[0].page.getByRole('button', { name: 'Start match' }).click();
  for (const p of s.players) await expect(p.page.locator('.status-bar')).toContainText('BRIEFING');
}
export async function repair(s: Squad) {
  await briefing(s);
  await acknowledge(s);
}
export async function acknowledge(s: Squad) {
  for (const p of s.players) {
    await selectTab(p.page, 'Brief');
    await p.page.getByRole('button', { name: 'I’ve read my evidence' }).click();
  }
  for (const p of s.players) await expect(p.page.locator('.status-bar')).toContainText(/REPAIR/);
}
export async function choose(page: Page, label: string, value: string) {
  const labels: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    NO_RETRY: 'No retry',
    RETRY_SAME_KEY: 'Retry once, same key',
    RETRY_NEW_IDENTITY: 'Retry once, new identity',
    OFF: 'Off',
    ON_READS_ONLY: 'Cache reads only',
  };
  const optionLabel = labels[value] ?? value;
  const control = page.getByLabel(label, { exact: true });
  await expect(control).toBeEnabled();
  await control.click();
  const drawer = page.getByRole('dialog');
  if (await drawer.isVisible())
    await drawer.getByRole('button', { name: optionLabel, exact: true }).click();
  else await page.getByRole('option', { name: optionLabel, exact: true }).click();
}
export async function referenceRepair(s: Squad) {
  const page = s.players[0].page,
    values = (
      JSON.parse(readFileSync(resolve('src/scenario/data/campuspass.v1.json'), 'utf8')) as {
        referenceRepair: ConfigurationValues;
      }
    ).referenceRepair;
  await selectTab(page, 'Repair');
  await choose(page, 'App capacity', values.appCapacity);
  await choose(page, 'Database capacity', values.dbCapacity);
  await choose(page, 'Retry policy', values.retryPolicy);
  await choose(page, 'Read cache', values.cache);
  const toggle = page.getByRole('switch', { name: 'Atomic check-in' });
  if ((await toggle.getAttribute('aria-checked')) !== String(values.atomicCheckin))
    await toggle.click();
}
export async function completeMatch(s: Squad) {
  await repair(s);
  const host = s.players[0].page;
  await selectTab(host, 'Repair');
  await host.getByRole('button', { name: 'Run baseline + incident' }).click();
  await expect(host.getByRole('button', { name: 'Reveal incident evidence' })).toBeEnabled({
    timeout: 30000,
  });
  await host.getByRole('button', { name: 'Reveal incident evidence' }).click();
  await acknowledge(s);
  await referenceRepair(s);
  await host.getByRole('button', { name: 'Run repair' }).click();
  await expect(host.locator('.status-bar')).toContainText('COMPARE', { timeout: 30000 });
  await selectTab(host, 'Results');
}
