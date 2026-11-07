import { test, expect } from './fixtures';

test('reference lobby shows three slots and starts only after all three players are ready', async ({
  squad: s,
}, testInfo) => {
  const host = s.players[0],
    second = s.players[1],
    third = s.players[2];
  await host.page.goto('/play');
  await host.page.getByRole('button', { name: 'Create squad', exact: true }).click();
  await expect(host.page).toHaveURL(/\/match\//);
  s.matchId = host.page.url().split('/').at(-1)!;
  const room = await s.db.match.findUniqueOrThrow({ where: { id: s.matchId } });
  await expect(host.page.getByRole('heading', { name: 'Your control room' })).toBeVisible();
  await expect(host.page.getByText('Waiting for engineer 2…')).toBeVisible();
  await expect(host.page.getByText('Waiting for engineer 3…')).toBeVisible();
  expect((await s.post(second, '/matches/join', { code: room.joinCode })).ok()).toBe(true);
  await expect(host.page.locator('.roster li')).toHaveCount(2);
  await expect(host.page.getByText('Waiting for engineer 2…')).toHaveCount(0);
  await expect(host.page.getByRole('button', { name: 'Start match', exact: true })).toBeDisabled();
  await host.page.getByRole('button', { name: 'Hide invite code' }).click();
  await expect(host.page.getByLabel('Invite code hidden', { exact: true })).toBeVisible();
  await host.page.getByRole('button', { name: 'Show invite code' }).click();
  await expect(
    host.page.getByLabel(`Invite code: ${room.joinCode}`, { exact: true }),
  ).toBeVisible();
  expect(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await expect(host.page.getByRole('button', { name: 'Join voice' })).toBeDisabled();
  await host.page.evaluate(() => window.scrollTo(0, 0));
  await host.page.screenshot({ path: testInfo.outputPath('lobby-reference.png'), fullPage: true });
  await host.page.getByRole('button', { name: 'Ready up', exact: true }).click();
  expect((await s.post(second, `/matches/${s.matchId}/ready`, { ready: true })).ok()).toBe(true);
  await expect(host.page.getByRole('progressbar', { name: 'Squad readiness' })).toHaveAttribute(
    'aria-valuenow',
    '2',
  );
  await expect(host.page.getByRole('button', { name: 'Start match', exact: true })).toBeDisabled();
  expect((await s.post(third, '/matches/join', { code: room.joinCode })).ok()).toBe(true);
  expect((await s.post(third, `/matches/${s.matchId}/ready`, { ready: true })).ok()).toBe(true);
  await expect(host.page.getByRole('button', { name: 'Start match', exact: true })).toBeEnabled();
  await host.page.getByRole('button', { name: 'Start match', exact: true }).click();
  await expect(host.page.locator('.status-bar')).toContainText('BRIEFING');
});
