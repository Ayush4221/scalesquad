import { test, expect, lobby } from './fixtures';
test('create, join, readiness, host authority and three-player capacity', async ({ squad: s }) => {
  await lobby(s);
  const [host, second, third] = s.players;
  await expect(host.page.getByRole('button', { name: 'Start match' })).toBeDisabled();
  expect((await s.post(second, `/matches/${s.matchId}/start`)).status()).toBe(403);
  const view = (await (
    await host.context.request.get(`/api/game/matches/${s.matchId}`)
  ).json()) as { joinCode: string; ownRole: unknown };
  expect(view.ownRole).toBeNull();
  expect((await s.post(s.outsider, '/matches/join', { code: view.joinCode })).status()).toBe(409);
  for (const p of [host, second, third])
    await p.page.getByRole('button', { name: 'Ready up', exact: true }).click();
  await expect(host.page.getByRole('button', { name: 'Start match' })).toBeEnabled();
  await host.page.getByRole('button', { name: 'Start match' }).click();
  for (const p of s.players) await expect(p.page.locator('.status-bar')).toContainText('BRIEFING');
});
test('bad and expired join codes fail without changing the roster', async ({ squad: s }) => {
  await lobby(s);
  const player = s.outsider.page;
  await player.goto('/play');
  await player.getByRole('textbox', { name: 'Join code' }).fill('ZZZZZZZZ');
  await player.getByRole('button', { name: 'Join' }).click();
  await expect(player.locator('.error[role="alert"]')).toBeVisible();
  await expect(player).toHaveURL(/\/play$/);
  const m = await s.db.match.update({
    where: { id: s.matchId },
    data: { joinCodeExpiresAt: new Date(0) },
  });
  await player.getByRole('textbox', { name: 'Join code' }).fill(m.joinCode);
  await player.getByRole('button', { name: 'Join' }).click();
  await expect(player.locator('.error[role="alert"]')).toContainText(/expired/i);
  expect(await s.db.matchMember.count({ where: { matchId: s.matchId } })).toBe(3);
});
test('leaving a lobby removes membership and host cannot leave', async ({ squad: s }) => {
  await lobby(s);
  expect((await s.post(s.players[0], `/matches/${s.matchId}/leave`)).status()).toBe(403);
  await s.players[1].page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(s.players[1].page).toHaveURL(/\/play$/);
  await expect(s.players[0].page.locator('.roster li')).toHaveCount(2);
  expect((await s.players[1].context.request.get(`/api/game/matches/${s.matchId}`)).status()).toBe(
    403,
  );
});
test('a failed leave keeps the player in the room and allows retry', async ({ squad: s }) => {
  await lobby(s);
  const player = s.players[1];
  await player.page.route(`**/api/game/matches/${s.matchId}/leave`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Chat is unavailable' },
      }),
    }),
  );
  await player.page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(player.page.getByRole('main').getByRole('alert')).toContainText(
    'The service is temporarily unavailable. Please try again.',
  );
  await expect(player.page).toHaveURL(new RegExp(`/match/${s.matchId}$`));
  expect(await s.db.matchMember.count({ where: { matchId: s.matchId } })).toBe(3);
  await player.page.unroute(`**/api/game/matches/${s.matchId}/leave`);
  await player.page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(player.page).toHaveURL(/\/play$/);
});
