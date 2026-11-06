import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError, Id, EmptyQuerySchema, parse } from '@scalesquad/shared';
import type { GameControllers, Context } from '../controllers/gameController';
import type { SessionService } from '../services/sessionService';
import { bodyParser } from '../middleware/bodyParser';
import { safeError } from '../middleware/errorHandler';
import { RateLimiter } from '../middleware/rateLimit';
import { originCheck, requestId, securityHeaders } from '../middleware/security';
import type { Logger } from 'pino';
import { clientIp } from '../utils/clientIp';
import type { authControllers, AuthOutput } from '../controllers/authController';
import type { pushControllers } from '../controllers/pushController';
import { AuthLimits } from '../middleware/authLimits';
import { sessionCookie } from '../utils/sessionCookie';

const gameRoutes = [
  ['GET', '/api/game/me', 'me'],
  ['POST', '/api/game/matches', 'create'],
  ['POST', '/api/game/matches/join', 'join'],
  ['GET', '/api/game/matches/:id', 'view'],
  ['POST', '/api/game/matches/:id/ready', 'ready'],
  ['POST', '/api/game/matches/:id/start', 'start'],
  ['POST', '/api/game/matches/:id/advance', 'advance'],
  ['POST', '/api/game/matches/:id/leave', 'leave'],
  ['POST', '/api/game/matches/:id/acknowledge', 'acknowledge'],
  ['GET', '/api/game/matches/:id/evidence', 'evidence'],
  ['GET', '/api/game/matches/:id/config', 'config'],
  ['POST', '/api/game/matches/:id/config', 'update'],
  ['POST', '/api/game/matches/:id/lock/pass', 'pass'],
  ['POST', '/api/game/matches/:id/lock/reclaim', 'reclaim'],
  ['GET', '/api/game/matches/:id/runs', 'runs'],
  ['POST', '/api/game/matches/:id/runs', 'run'],
  ['POST', '/api/game/nexconn/token', 'token'],
] as const;
const authRoutes = [
  ['POST', '/api/game/auth/register', 'authRegister', 'public'],
  ['POST', '/api/game/auth/login', 'authLogin', 'public'],
  ['POST', '/api/game/auth/logout', 'authLogout', 'session'],
  ['POST', '/api/game/auth/logout-all', 'authLogoutAll', 'session'],
  ['POST', '/api/game/auth/change-password', 'authChange', 'session'],
] as const;
export const routeRegistry = [
  ...gameRoutes.map((route) => [...route, 'session'] as const),
  ...authRoutes,
  ['GET', '/api/game/push/key', 'pushKey', 'session'],
  ['POST', '/api/game/push/subscription', 'pushSubscribe', 'session'],
  ['DELETE', '/api/game/push/subscription', 'pushUnsubscribe', 'session'],
] as const;
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
      const route = routeRegistry.find(
        ([m, p]) =>
          m === method && new RegExp(`^${p.replace(':id', '([A-Za-z0-9_-]+)')}$`).test(path),
      );
      if ((!route || route[3] === 'session') && !user) throw new AppError('UNAUTHENTICATED', 401);
      if (!route) throw new AppError('NOT_FOUND', 404);
      parse(EmptyQuerySchema, Object.fromEntries(url.searchParams));
      if (route[2] === 'join') {
        join.take(ip);
        join.take(`u:${user!.userId}`);
      }
      if (route[2] === 'run') runs.take(user!.userId);
      if (route[2].startsWith('push')) pushLimits.take(user!.userId);
      const matchId = route[1].includes(':id') ? (path.split('/')[4] ?? '') : '';
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
      authLimits.take(route[2], ip, ctx.userId, ctx.body);
      const handler = controllers[route[2]];
      if (!handler) throw new AppError('UPSTREAM_UNAVAILABLE', 503);
      let output = await handler(ctx);
      if (route[2].startsWith('auth')) {
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
