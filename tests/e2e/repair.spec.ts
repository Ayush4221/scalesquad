import { test, expect, repair, selectTab, choose } from './fixtures';
test('editor changes, read-only peers, handoff and server-side authorization', async ({
  squad: s,
}) => {
  await repair(s);
  const [host, peer] = s.players;
  await selectTab(host.page, 'Repair');
  await selectTab(peer.page, 'Repair');
  await expect(peer.page.getByLabel('App capacity', { exact: true })).toBeDisabled();
  expect(
    (
      await s.post(peer, `/matches/${s.matchId}/config`, {
        expectedVersion: 0,
        change: { atomicCheckin: true },
      })
    ).status(),
  ).toBe(403);
  await choose(host.page, 'App capacity', 'MEDIUM');
  await expect(host.page.getByText('v1', { exact: true })).toBeVisible();
  await choose(host.page, 'Pass control to', peer.name);
  await host.page.getByRole('button', { name: 'Pass control', exact: true }).click();
  await expect(peer.page.getByLabel('App capacity', { exact: true })).toBeEnabled();
  await expect(host.page.getByLabel('App capacity', { exact: true })).toBeDisabled();
  await peer.page.getByRole('switch', { name: 'Atomic check-in' }).click();
  await expect(peer.page.getByText('v2', { exact: true })).toBeVisible();
});
test('stale editor version shows a conflict and resyncs to the saved value', async ({
  squad: s,
}) => {
  await repair(s);
  const host = s.players[0];
  await selectTab(host.page, 'Repair');
  await host.page.route(`**/api/game/matches/${s.matchId}/config`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const data = route.request().postDataJSON() as Record<string, unknown>;
    await route.continue({ postData: JSON.stringify({ ...data, expectedVersion: 99 }) });
  });
  await choose(host.page, 'App capacity', 'HIGH');
  await expect(host.page.locator('.error[role="alert"]')).toContainText(/changed|refresh/i);
  expect(
    (
      await s.db.configuration.findFirstOrThrow({
        where: { matchId: s.matchId },
        orderBy: { version: 'desc' },
      })
    ).version,
  ).toBe(0);
});
