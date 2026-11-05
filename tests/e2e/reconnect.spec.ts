import { test, expect, repair, choose, selectTab } from './fixtures';
test('offline peer reconnects and receives the latest configuration snapshot', async ({
  squad: s,
}) => {
  await repair(s);
  const [host, peer] = s.players;
  await peer.context.setOffline(true);
  await selectTab(host.page, 'Repair');
  await choose(host.page, 'App capacity', 'MEDIUM');
  await peer.context.setOffline(false);
  await peer.page.reload();
  await selectTab(peer.page, 'Repair');
  await expect(peer.page.getByText('v1', { exact: true })).toBeVisible();
  await expect(peer.page.locator('.status-bar')).toContainText('connected');
});
test('host reclaims after a disconnected editor lease passes its grace period', async ({
  squad: s,
}) => {
  await repair(s);
  const [host, peer] = s.players;
  await selectTab(host.page, 'Repair');
  await choose(host.page, 'Pass control to', peer.name);
  await host.page.getByRole('button', { name: 'Pass control', exact: true }).click();
  await expect(host.page.getByLabel('App capacity', { exact: true })).toBeDisabled();
  await peer.page.close();
  await expect
    .poll(
      async () =>
        (
          await s.db.matchMember.findUniqueOrThrow({
            where: { matchId_userId: { matchId: s.matchId, userId: peer.id } },
          })
        ).disconnectedAt,
    )
    .not.toBeNull();
  // Move only this disposable member's timestamp; no production clock override exists.
  await s.db.matchMember.update({
    where: { matchId_userId: { matchId: s.matchId, userId: peer.id } },
    data: { disconnectedAt: new Date(Date.now() - 20000) },
  });
  await host.page.getByRole('button', { name: 'Reclaim control', exact: true }).click();
  await expect(host.page.getByLabel('App capacity', { exact: true })).toBeEnabled();
});
