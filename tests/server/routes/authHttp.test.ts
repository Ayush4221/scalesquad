import { afterEach, describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { authFixture } from '../authFakes';
import { fixture } from '../fakes';
import { authControllers } from '../../../src/server/controllers/authController';
import { gameControllers } from '../../../src/server/controllers/gameController';
import { createHttpHandler } from '../../../src/server/routes/http';
import { SessionService } from '../../../src/server/services/sessionService';
import { createLogger } from '../../../src/server/infra/logger';
import { sessionCookie } from '../../../src/server/utils/sessionCookie';
import { SESSION_SECONDS } from '../../../src/constants/auth';
import { RegisterSchema, LoginSchema, ChangePasswordSchema } from '@scalesquad/shared';
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((r) => s.close(() => r()));
  }
});
async function setup(production = false) {
  const appOrigin = production ? 'https://game.example' : 'http://game.example';
  const f = authFixture(),
    game = fixture();
  const session = new SessionService(
    {
      async find(token) {
        const s = f.sessions.get(token),
          user = s ? f.users.get(s.userId) : null;
        return s && user
          ? { userId: user.id, name: user.name ?? 'Player', expires: s.expires }
          : null;
      },
    },
    f.clock,
    production,
  );
  const server = createServer(
    createHttpHandler(
      { ...gameControllers(game.services), ...authControllers(f.auth) },
      session,
      appOrigin,
      production,
      createLogger('silent'),
      ['127.0.0.1'],
    ),
  );
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const post = (
    route: string,
    body: unknown,
    cookie = '',
    origin = appOrigin,
    ip = '203.0.113.1',
  ) =>
    fetch(`http://127.0.0.1:${address.port}/api/game/auth/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin, cookie, 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });
  return { ...f, post };
}
describe('password HTTP boundaries', () => {
  it('allows the owner to log in after attackers exhaust the account failure quota', async () => {
    const f = await setup();
    const user = await f.registered();
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await f.post(
        'login',
        { email: user.email, password: 'incorrect password' },
        '',
        undefined,
        `203.0.113.${attempt + 10}`,
      );
      expect(response.status).toBe(attempt < 10 ? 401 : 429);
    }
    const response = await f.post(
      'login',
      { email: user.email, password: f.password },
      '',
      undefined,
      '198.51.100.90',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('session-token=');
  });
  it('rejects a login burst without one database audit write per rejected request', async () => {
    const f = await setup();
    const responses = await Promise.all(
      Array.from({ length: 32 }, () =>
        f.post('login', {
          email: 'unknown@example.invalid',
          password: 'incorrect value here',
        }),
      ),
    );
    expect(responses.filter((response) => response.status === 401)).toHaveLength(5);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(27);
    expect(f.audit.record.mock.calls.filter(([type]) => type === 'THROTTLED')).toHaveLength(1);
    expect(f.hasher.verify).toHaveBeenCalledTimes(5);
  });
  it('production signup/login work without mail and issue only secure session cookies', async () => {
    const f = await setup(true);
    const email = 'production-mode@example.invalid';
    expect((await f.post('register', { email, name: 'Test', password: f.password })).status).toBe(
      200,
    );
    const login = await f.post('login', { email, password: f.password });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!;
    expect(cookie).toContain('__Secure-authjs.session-token=');
    expect(cookie).toContain('; Secure');
    const secureCookie = cookie.split(';')[0]!;
    expect((await f.post('logout', {}, secureCookie.replace('__Secure-', ''))).status).toBe(401);
    expect((await f.post('logout', {}, secureCookie)).status).toBe(200);
  });
  it('removed email endpoints return 404 and logout-all revokes the session', async () => {
    const f = await setup(),
      u = await f.registered();
    const login = await f.post('login', {
        email: u.email,
        password: f.password,
      }),
      cookie = login.headers.get('set-cookie')!.split(';')[0];
    for (const route of ['verify', 'resend', 'forgot', 'reset']) {
      expect((await f.post(route, { email: u.email }, cookie)).status).toBe(404);
      expect((await f.post(route, { email: u.email })).status).toBe(401);
    }
    expect((await f.post('logout-all', {}, cookie)).status).toBe(200);
    expect(f.sessions.size).toBe(0);
  });
  it('registers, immediately logs in with the shared cookie, changes password and logs out', async () => {
    const f = await setup(),
      body = { email: 'ada@example.invalid', name: 'Ada', password: f.password };
    const first = await f.post('register', body),
      second = await f.post('register', body);
    expect(first.status).toBe(second.status);
    expect(await first.json()).toEqual(await second.json());
    expect(first.headers.get('cache-control')).toBe('no-store');
    const login = await f.post('login', { email: body.email, password: f.password }),
      cookie = login.headers.get('set-cookie')!;
    expect(login.status).toBe(200);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(`Max-Age=${SESSION_SECONDS}`);
    expect(JSON.stringify(await login.json())).not.toContain('token');
    expect(
      (
        await f.post(
          'change-password',
          { currentPassword: f.password, newPassword: 'Silent!42 forests dancing slowly' },
          cookie.split(';')[0],
        )
      ).status,
    ).toBe(200);
    const logout = await f.post('logout', {}, cookie.split(';')[0]);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(f.sessions.size).toBe(0);
  });
  it('blocks CSRF, malformed bodies, unknown fields, and non-session private routes', async () => {
    const f = await setup();
    for (const route of ['register', 'login', 'logout', 'logout-all', 'change-password'])
      expect((await f.post(route, {}, '', 'http://evil.example')).status).toBe(403);
    for (const route of ['logout', 'logout-all', 'change-password'])
      expect((await f.post(route, {})).status).toBe(401);
    expect(
      (
        await f.post('register', {
          email: 'ada@example.invalid',
          name: 'Ada',
          password: f.password,
          admin: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (await f.post('login', { email: 'a@example.invalid', password: f.password, admin: true }))
        .status,
    ).toBe(400);
  });
  it('keys login limits by trusted IP and normalized email/IP pair', async () => {
    const f = await setup();
    for (let i = 0; i < 5; i++)
      expect(
        (
          await f.post('login', {
            email: 'unknown@example.invalid',
            password: 'incorrect value here',
          })
        ).status,
      ).toBe(401);
    const limited = await f.post('login', {
      email: ' UNKNOWN@example.invalid ',
      password: 'incorrect value here',
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(
      (
        await f.post(
          'login',
          { email: 'unknown@example.invalid', password: 'incorrect value here' },
          '',
          'http://game.example',
          '203.0.113.2',
        )
      ).status,
    ).toBe(401);
  });
  it('strict schemas cap input and cookie clearing matches secure flags', () => {
    expect(
      RegisterSchema.safeParse({
        email: 'a@example.invalid',
        name: 'x'.repeat(61),
        password: 'x'.repeat(12),
      }).success,
    ).toBe(false);
    expect(
      LoginSchema.safeParse({ email: 'a@example.invalid', password: 'x'.repeat(129) }).success,
    ).toBe(false);
    expect(
      ChangePasswordSchema.safeParse({ currentPassword: 'current', newPassword: 'pass', extra: 1 })
        .success,
    ).toBe(false);
    expect(sessionCookie('abc', true)).toContain('__Secure-authjs.session-token=abc;');
    expect(sessionCookie('', true, true)).toContain('Max-Age=0; Secure');
  });
});
