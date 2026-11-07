import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import next from 'next';
import { readEnv } from './config/env';
import { createLogger } from './infra/logger';
import { systemClock, type DomainEvents } from './domain/ports';
import { executeSimulation } from './infra/simulationExecutor';
import { prepareSimulationEngine } from './infra/prepareSimulation';
import { PrismaMatchRepository } from './repositories/matchRepository';
import { PrismaSessionRepository, PrismaUserRepository } from './repositories/sessionRepository';
import { PrismaEvidenceRepository } from './repositories/evidenceRepository';
import {
  installAuthAdapter,
  disconnectDatabase,
  purgeUnusedProviderTokens,
} from './repositories/authRepository';
import { NexconnChatProvider } from '@scalesquad/nexconn/provider';
import { DisabledChatProvider, FakeChatProvider } from '@scalesquad/nexconn/fake';
import { SessionService } from './services/sessionService';
import { MatchService } from './services/matchService';
import { ConfigService } from './services/configService';
import { EditLockService } from './services/editLockService';
import { EvidenceService } from './services/evidenceService';
import { MaintenanceService } from './services/maintenanceService';
import { RunService } from './services/runService';
import { gameControllers } from './controllers/gameController';
import { createWsController } from './controllers/wsController';
import { createHttpHandler } from './routes/http';
import { attachGateway } from './ws/gateway';
import { Rooms } from './ws/rooms';
import { securityHeaders } from './middleware/security';
import { clientIp } from './utils/clientIp';
import { AuthService } from './services/authService';
import { ScryptPasswordHasher } from './services/passwordService';
import { PrismaUserAuthRepository } from './repositories/userAuthRepository';
import { PrismaSessionWriteRepository } from './repositories/sessionWriteRepository';
import { PrismaAuthEventRepository } from './repositories/authEventRepository';
import { authControllers } from './controllers/authController';
import { PushService } from './services/pushService';
import { PrismaPushRepository } from './repositories/pushRepository';
import { pushControllers } from './controllers/pushController';
import { WebPushTransport } from './infra/webPushTransport';

async function main() {
  const env = readEnv(process.env),
    logger = createLogger(env.LOG_LEVEL),
    origin = new URL(env.APP_ORIGIN);
  const development = env.NODE_ENV !== 'production' && !env.TEST_BUILT_APP;
  // Auth.js must infer HTTPS callback URLs from our validated public origin,
  // rather than trusting arbitrary forwarding headers.
  process.env.AUTH_URL = env.APP_ORIGIN;
  Object.assign(process.env, { NODE_ENV: env.NODE_ENV });
  const repo = new PrismaMatchRepository(),
    users = new PrismaUserRepository();
  const session = new SessionService(
    new PrismaSessionRepository(),
    systemClock,
    env.NODE_ENV === 'production',
  );
  const chat =
    env.NEXCONN_PROVIDER === 'fake'
      ? new FakeChatProvider()
      : env.NEXCONN_PROVIDER !== 'disabled' && env.NEXCONN_APP_KEY
        ? new NexconnChatProvider(env.NEXCONN_APP_KEY, env.NEXCONN_APP_SECRET, env.NEXCONN_REGION)
        : new DisabledChatProvider();
  const rooms = new Rooms((id) => match.memberIds(id));
  const refresh = async (id: string) => {
    const peers = [...rooms.peers].filter((peer) => peer.room === id);
    if (!peers.length) return;
    const views = await match.getPublicViews(
      peers.map((peer) => peer.userId),
      id,
    );
    for (const peer of peers) {
      // A socket may have switched rooms while the graph was loading.
      if (peer.room !== id) continue;
      const view = views.get(peer.userId);
      if (view) await rooms.sendAuthorized(peer, { type: 'match.snapshot', payload: view });
      else {
        peer.room = null;
        peer.socket.close(1008, 'Membership ended');
      }
    }
  };
  installAuthAdapter((token) => rooms.revokeSession(token));
  await purgeUnusedProviderTokens();
  const authUsers = new PrismaUserAuthRepository();
  const authService = new AuthService(
    authUsers,
    new PrismaSessionWriteRepository(),
    new PrismaAuthEventRepository(),
    new ScryptPasswordHasher(),
    systemClock,
    {
      session: (token) => rooms.revokeSession(token),
      user: (id, except) => rooms.revokeUser(id, except),
    },
  );
  const push = new PushService(
    new PrismaPushRepository(),
    env.VAPID_PUBLIC_KEY
      ? new WebPushTransport({
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT,
        })
      : null,
    (id) => rooms.foregroundConnected(id),
    env.VAPID_PUBLIC_KEY,
  );
  const events: DomainEvents = {
    notification: (userId, kind, id) => {
      void push.notify(userId, kind, id);
    },
    changed: (id) => {
      void refresh(id).catch(() => logger.error('State refresh failed'));
    },
    evidenceAvailable: (id, userId, phase) => {
      void push.notify(userId, 'EVIDENCE_AVAILABLE', id);
      void rooms
        .sendToUser(id, userId, { type: 'evidence.available', payload: { phase } })
        .catch(() => logger.error('Notification failed'));
    },
    runStarted: (id, runNumber) => {
      void rooms
        .broadcast(id, { type: 'run.started', payload: { matchId: id, runNumber } })
        .catch(() => logger.error('Notification failed'));
    },
    runCompleted: (id, runNumber, result) => {
      void repo
        .find(id)
        .then((match) =>
          Promise.all(
            (match?.members ?? []).map((member) => push.notify(member.userId, 'RUN_COMPLETED', id)),
          ),
        )
        .catch(() => {});
      void rooms
        .broadcast(id, {
          type: 'run.completed',
          payload: { matchId: id, runNumber, summary: result },
        })
        .catch(() => logger.error('Notification failed'));
    },
  };
  const match = new MatchService(repo, users, chat, systemClock, events, randomUUID);
  const lock = new EditLockService(repo, systemClock, events),
    run = new RunService(repo, systemClock, events, executeSimulation);
  const services = {
    match,
    lock,
    run,
    config: new ConfigService(repo, systemClock, events),
    evidence: new EvidenceService(repo, new PrismaEvidenceRepository()),
  };
  const app = next({
    dev: development,
    dir: process.cwd(),
    turbopack: false,
  });
  await app.prepare();
  await prepareSimulationEngine();
  const nextHandler = app.getRequestHandler();
  const api = createHttpHandler(
    { ...gameControllers(services), ...authControllers(authService), ...pushControllers(push) },
    session,
    env.APP_ORIGIN,
    env.NODE_ENV === 'production',
    logger,
    env.TRUSTED_PROXY_IPS,
  );
  const authLimit = new (await import('./utils/rateLimit')).RateLimiter(20, 0.5);
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (req.url?.split('?')[0] === '/sw.js') res.setHeader('Cache-Control', 'no-cache');
    // Only the configured host is trusted, including for Auth.js callback URL inference.
    delete req.headers['x-forwarded-host'];
    delete req.headers['x-forwarded-proto'];
    if (req.headers.host !== origin.host) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    for (const [key, value] of Object.entries(
      securityHeaders(env.NODE_ENV === 'production', env.APP_ORIGIN, development),
    ))
      res.setHeader(key, value);
    if (req.url?.startsWith('/api/game') || req.url === '/healthz') void api(req, res);
    else {
      if (req.url?.startsWith('/api/auth')) {
        try {
          authLimit.take(clientIp(req, env.TRUSTED_PROXY_IPS));
        } catch {
          res.writeHead(429, { 'Retry-After': '10' });
          res.end('Try again later');
          return;
        }
      }
      void nextHandler(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end('Service unavailable');
      });
    }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  const gateway = attachGateway(
    server,
    env.APP_ORIGIN,
    session,
    createWsController(services),
    rooms,
    (user, id, connected) => lock.presence(user, id, connected),
    env.TRUSTED_PROXY_IPS,
    { development },
  );
  for (const m of await repo.active()) await run.recover(m);
  const maintenance = new MaintenanceService(repo, systemClock, events, chat);
  let checking = false,
    sweeping = false;
  const timer = setInterval(() => {
    if (checking) return;
    checking = true;
    void maintenance
      .due()
      .then(async (ids) => {
        for (const id of ids) await match.expire(id);
      })
      .catch(() => logger.error('Phase timer check failed'))
      .finally(() => {
        checking = false;
      });
  }, 1000);
  timer.unref();
  const sweep = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void maintenance
      .sweep()
      .catch(() => logger.error('Match cleanup failed'))
      .finally(() => {
        sweeping = false;
      });
  }, 60000);
  sweep.unref();
  const port = Number(origin.port || (origin.protocol === 'https:' ? 3000 : 80));
  server.listen(port, '127.0.0.1', () => logger.info({ port }, 'ScaleSquad ready'));
  const shutdown = () => {
    clearInterval(timer);
    clearInterval(sweep);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    void Promise.all([
      gateway.close(),
      new Promise<void>((resolve) => server.close(() => resolve())),
    ])
      .then(() => disconnectDatabase())
      .then(() => app.close())
      .then(() => {
        clearTimeout(force);
        process.exitCode = 0;
      });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
void main().catch((error) => {
  createLogger().error(
    {
      message:
        error instanceof Error && error.message.startsWith('Invalid environment fields:')
          ? error.message
          : 'Startup failed',
    },
    'Unable to start',
  );
  process.exitCode = 1;
});
