import { afterEach, describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fixture } from '../fakes';
import { gameControllers } from '../../../src/server/controllers/gameController';
import { SessionService } from '../../../src/server/services/sessionService';
import { createLogger } from '../../../src/server/lib/logger';
import { createHttpHandler, routeRegistry } from '../../../src/server/routes/http';
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
});
async function setup() {
  const f = fixture();
  const sessions = new SessionService(
    {
      async find(token) {
        return ['a', 'b', 'c', 'd'].includes(token)
          ? { userId: token, name: token, expires: 999999 }
          : null;
      },
    },
    f.clock,
  );
  const server = createServer(
    createHttpHandler(
      gameControllers(f.services),
      sessions,
      'http://game.example',
      true,
      createLogger('silent'),
    ),
  );
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const request = (
    path: string,
    method = 'GET',
    user: string | null = 'a',
    body: unknown = {},
    origin = 'http://game.example',
  ) =>
    fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        ...(user ? { cookie: `authjs.session-token=${user}` } : {}),
        Origin: origin,
        'Content-Type': 'application/json',
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
  return { ...f, request };
}
describe('real HTTP request boundary', () => {
  it('health is public; auth, headers, safe 404 and origin enforcement hold', async () => {
    const f = await setup();
    const health = await f.request('/healthz', 'GET', null);
    expect(await health.json()).toEqual({ status: 'ok' });
    expect(health.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect((await f.request('/api/game/me', 'GET', null)).status).toBe(401);
    expect((await f.request('/api/game/me')).status).toBe(200);
    expect((await f.request('/api/game/unknown')).status).toBe(404);
    expect(
      (await f.request('/api/game/matches', 'POST', 'a', {}, 'http://evil.example')).status,
    ).toBe(403);
  });
  it('every route denies unauthenticated input; member-only reads reject outsiders', async () => {
    const f = await setup(),
      id = await f.repair();
    for (const [method, path, , access] of routeRegistry)
      if (access === 'session')
        expect((await f.request(path.replace(':id', id), method, null)).status).toBe(401);
    expect(routeRegistry.filter((r) => r[3] === 'public').map((r) => r[1])).toEqual([
      '/api/game/auth/register',
      '/api/game/auth/login',
    ]);
    for (const path of ['', '/config', '/evidence', '/runs'])
      expect((await f.request(`/api/game/matches/${id}${path}`, 'GET', 'd')).status).toBe(403);
    const own = await f.request(`/api/game/matches/${id}/evidence?userId=b`);
    expect(own.status).toBe(400);
    expect(await (await f.request(`/api/game/matches/${id}/evidence`)).json()).toEqual(
      await f.evidence.get('a', id),
    );
    const unknown = await f.request(`/api/game/matches/${id}/config`, 'POST', 'a', {
      change: { cacheAsAuthority: true },
      expectedVersion: 0,
    });
    expect(unknown.status).toBe(400);
    expect(
      (
        await f.request(`/api/game/matches/${id}/config`, 'POST', 'b', {
          change: { atomicCheckin: true },
          expectedVersion: 0,
        })
      ).status,
    ).toBe(403);
  });
  it('join attempts and run starts rate limited; responses have Retry-After', async () => {
    const f = await setup();
    let limited: Response | null = null;
    for (let i = 0; i < 10; i++) {
      const r = await f.request('/api/game/matches/join', 'POST', 'a', { code: 'ABCDEFGH' });
      if (r.status === 429) {
        limited = r;
        break;
      }
    }
    expect(limited?.headers.get('retry-after')).toBeTruthy();
    let rate: Response | null = null;
    for (let i = 0; i < 130; i++) {
      const r = await f.request('/api/game/me');
      if (r.status === 429) {
        rate = r;
        break;
      }
    }
    expect(rate?.status).toBe(429);
  });
});
