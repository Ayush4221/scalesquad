import { test, expect, lobby } from './fixtures';
import { routeRegistry } from '../../src/server/routes/http';
import { localBaseURL } from './settings';
test('route registry stays authenticated, strict and phase/membership protected', async ({
  squad: s,
  request,
}) => {
  await lobby(s);
  const [host, peer] = s.players;
  for (const [method, path, , access] of routeRegistry) {
    if (access !== 'session') continue;
    const response = await request.fetch(path.replace(':id', s.matchId), {
      method,
      headers: { Origin: localBaseURL },
      ...(method === 'GET' ? {} : { data: {} }),
    });
    expect(response.status(), `${method} ${path}`).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
  for (const path of ['', '/config', '/evidence', '/runs'])
    expect(
      (await s.outsider.context.request.get(`/api/game/matches/${s.matchId}${path}`)).status(),
    ).toBe(403);
  for (const path of ['/acknowledge', '/advance', '/lock/reclaim'])
    expect((await s.post(host, `/matches/${s.matchId}${path}`)).status()).toBe(409);
  expect((await s.post(peer, `/matches/${s.matchId}/start`)).status()).toBe(403);
  expect(
    (
      await s.post(host, `/matches/${s.matchId}/config`, {
        expectedVersion: 0,
        change: { atomicCheckin: true, admin: true },
      })
    ).status(),
  ).toBe(400);
  expect((await s.post(s.outsider, '/nexconn/token', { matchId: s.matchId })).status()).toBe(403);
});
