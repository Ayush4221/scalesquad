import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, Id, EmptyQuerySchema, parse } from '@scalesquad/shared';
import type { GameControllers, Context } from '../controllers/gameController';
import type { SessionService } from '../services/sessionService';
import { bodyParser } from '../middleware/bodyParser';
import { safeError } from '../middleware/errorHandler';
import { RateLimiter } from '../utils/rateLimit';
import { originCheck, requestId, securityHeaders } from '../middleware/security';
import type { Logger } from 'pino';
import { clientIp } from '../utils/clientIp';
import type { authControllers, AuthOutput } from '../controllers/authController';
import type { pushControllers } from '../controllers/pushController';
import { AuthLimits } from '../middleware/authLimits';
import { sessionCookie } from '../utils/sessionCookie';

export const routeRegistry = [
  { method: 'GET', path: '/api/game/me', handler: 'me', access: 'session' },
  { method: 'POST', path: '/api/game/matches', handler: 'create', access: 'session' },
  { method: 'POST', path: '/api/game/matches/join', handler: 'join', access: 'session' },
  { method: 'GET', path: '/api/game/matches/:id', handler: 'view', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/ready', handler: 'ready', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/start', handler: 'start', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/advance', handler: 'advance', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/leave', handler: 'leave', access: 'session' },
  {
    method: 'POST',
    path: '/api/game/matches/:id/acknowledge',
    handler: 'acknowledge',
    access: 'session',
  },
  { method: 'GET', path: '/api/game/matches/:id/evidence', handler: 'evidence', access: 'session' },
  { method: 'GET', path: '/api/game/matches/:id/config', handler: 'config', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/config', handler: 'update', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/lock/pass', handler: 'pass', access: 'session' },
  {
    method: 'POST',
    path: '/api/game/matches/:id/lock/reclaim',
    handler: 'reclaim',
    access: 'session',
  },
  { method: 'GET', path: '/api/game/matches/:id/runs', handler: 'runs', access: 'session' },
  { method: 'POST', path: '/api/game/matches/:id/runs', handler: 'run', access: 'session' },
  { method: 'POST', path: '/api/game/nexconn/token', handler: 'token', access: 'session' },
  { method: 'POST', path: '/api/game/auth/register', handler: 'authRegister', access: 'public' },
  { method: 'POST', path: '/api/game/auth/login', handler: 'authLogin', access: 'public' },
  { method: 'POST', path: '/api/game/auth/logout', handler: 'authLogout', access: 'session' },
  {
    method: 'POST',
    path: '/api/game/auth/logout-all',
    handler: 'authLogoutAll',
    access: 'session',
  },
  {
    method: 'POST',
    path: '/api/game/auth/change-password',
    handler: 'authChange',
    access: 'session',
  },
  { method: 'GET', path: '/api/game/push/key', handler: 'pushKey', access: 'session' },
  {
    method: 'POST',
    path: '/api/game/push/subscription',
    handler: 'pushSubscribe',
    access: 'session',
  },
  {
    method: 'DELETE',
    path: '/api/game/push/subscription',
    handler: 'pushUnsubscribe',
    access: 'session',
  },
] as const;
const routes = routeRegistry.map((route) => ({
  ...route,
  pattern: new RegExp('^' + route.path.replace(':id', '([A-Za-z0-9_-]+)') + '$'),
}));

type Controllers = GameControllers &
  Partial<ReturnType<typeof authControllers> & ReturnType<typeof pushControllers>>;
export function createHttpHandler(
  controllers: Controllers,
  session: SessionService,
  origin: string,
  production: boolean,
  logger: Logger,
  trustedProxyIps: readonly string[] = [],
) {
  const general = new RateLimiter(120, 2),
    join = new RateLimiter(8, 0.1),
    runs = new RateLimiter(5, 0.1);
  const authLimits = new AuthLimits(),
    pushLimits = new RateLimiter(20, 1 / 3);
  return async (req: IncomingMessage, res: ServerResponse) => {
    const id = requestId();
    res.setHeader('X-Request-Id', id);
    for (const [key, value] of Object.entries(securityHeaders(production, origin)))
      res.setHeader(key, value);
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url ?? '/', origin);
      const path = url.pathname,
        method = req.method ?? 'GET';
      if (path === '/healthz' && method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      originCheck(
        method,
        req.headers.origin,
        typeof req.headers['sec-fetch-site'] === 'string'
          ? req.headers['sec-fetch-site']
          : undefined,
        origin,
      );
      const ip = clientIp(req, trustedProxyIps);
      general.take(ip);
      const user = await session.resolveFromCookie(req.headers.cookie);
      if (user) general.take(`u:${user.userId}`);
      const route = routes.find((route) => route.method === method && route.pattern.test(path));
      if ((!route || route.access === 'session') && !user)
        throw new AppError('UNAUTHENTICATED', 401);
      if (!route) throw new AppError('NOT_FOUND', 404);
      parse(EmptyQuerySchema, Object.fromEntries(url.searchParams));
      if (route.handler === 'join') {
        join.take(ip);
        join.take(`u:${user!.userId}`);
      }
      if (route.handler === 'run') runs.take(user!.userId);
      if (route.handler.startsWith('push')) pushLimits.take(user!.userId);
      const matchId = route.path.includes(':id') ? (path.split('/')[4] ?? '') : '';
      if (matchId) parse(Id, matchId);
      const ctx: Context = {
        userId: user?.userId ?? null,
        name: user?.name ?? null,
        matchId,
        body: method === 'GET' ? {} : await bodyParser(req),
        ip,
        userAgent: req.headers['user-agent'] ?? '',
        sessionToken: session.cookieToken(req.headers.cookie),
      };
      authLimits.take(route.handler, ip, ctx.userId, ctx.body);
      const handler = controllers[route.handler];
      if (!handler) throw new AppError('UPSTREAM_UNAVAILABLE', 503);
      let output = await handler(ctx);
      if (route.handler.startsWith('auth')) {
        const auth = output as AuthOutput;
        if (auth.session)
          res.setHeader(
            'Set-Cookie',
            sessionCookie(auth.session.token, production, auth.session.clear),
          );
        output = auth.body as typeof output;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(output ?? { ok: true }));
    } catch (error) {
      const safe = safeError(error, id);
      if (safe.status === 429 && req.url?.startsWith('/api/game/auth/'))
        await controllers
          .authThrottled?.({
            userId: null,
            name: null,
            matchId: '',
            body: {},
            ip: clientIp(req, trustedProxyIps),
            userAgent: req.headers['user-agent'] ?? '',
          })
          .catch(() => {});
      res.statusCode = safe.status;
      res.setHeader('Content-Type', 'application/json');
      if (safe.status === 429)
        res.setHeader(
          'Retry-After',
          String(error instanceof AppError ? (error.retryAfterSeconds ?? 1) : 1),
        );
      logger.warn({ requestId: id, code: safe.body.error.code }, 'Request rejected');
      res.end(JSON.stringify(safe.body));
    }
  };
}
