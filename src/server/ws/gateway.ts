import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { AppError, ClientEvent, MAX_MESSAGE_BYTES } from '@scalesquad/shared';
import { RateLimiter } from '../utils/rateLimit';
import { parseJson } from '../middleware/bodyParser';
import type { SessionService } from '../services/sessionService';
import type { createWsController } from '../controllers/wsController';
import { Rooms, type Peer } from './rooms';
import { clientIp } from '../utils/clientIp';

export function attachGateway(
  server: Server,
  origin: string,
  session: SessionService,
  dispatch: ReturnType<typeof createWsController>,
  rooms: Rooms,
  presence: (userId: string, id: string, connected: boolean) => Promise<void>,
  trustedProxyIps: readonly string[] = [],
  options: { development?: boolean } = {},
) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const upgrades = new RateLimiter(10, 0.2);
  server.on('upgrade', (req, socket, head) => {
    void (async () => {
      try {
        // Next attaches its own upgrade listener. Leave only its same-origin
        // development reload channel to that listener; /ws still requires a session.
        if (
          options.development &&
          req.url?.split('?')[0] === '/_next/hmr' &&
          req.headers.origin === origin &&
          req.headers.host === new URL(origin).host
        )
          return;
        if (req.url !== '/ws' || req.headers.origin !== origin)
          throw new AppError('FORBIDDEN', 403);
        upgrades.take(clientIp(req, trustedProxyIps));
        const user = await session.openSocket(req.headers.cookie);
        if (!user) throw new AppError('UNAUTHENTICATED', 401);
        wss.handleUpgrade(req, socket, head, (ws) => {
          const peer: Peer = {
            socket: ws,
            userId: user.userId,
            room: null,
            alive: true,
            sessionToken: user.token,
            foreground: true,
            authorize: user.authorize,
          };
          rooms.peers.add(peer);
          const limit = new RateLimiter(30, 5);
          let violations = 0;
          let accepting = true;
          let pending = 0;
          let messages = Promise.resolve();
          void rooms
            .sendAuthorized(peer, { type: 'hello', payload: { userId: user.userId } })
            .catch(() => ws.close(1011, 'Connection failed'));
          ws.on('pong', () => {
            peer.alive = true;
          });
          ws.on('error', () => {});
          ws.on('message', (data) => {
            if (!accepting || ws.readyState !== WebSocket.OPEN) return;
            // Admit frames before adding asynchronous work. Slow session checks must
            // not let a sender build an unbounded promise/data queue.
            try {
              limit.take(user.userId);
              if (pending >= 30) throw new AppError('RATE_LIMITED', 429);
            } catch {
              accepting = false;
              void rooms
                .sendAuthorized(peer, {
                  type: 'error',
                  payload: { code: 'RATE_LIMITED', message: 'Too many requests' },
                })
                .then(() => ws.close(1008, 'Message limit exceeded'))
                .catch(() => ws.close(1011, 'Connection failed'));
              return;
            }
            pending++;
            messages = messages
              .then(async () => {
                if (!accepting || ws.readyState !== WebSocket.OPEN) return;
                try {
                  // Logout/expiry invalidates already-open sockets as well as new upgrades.
                  if (!(await peer.authorize(true))) {
                    ws.close(1008, 'Session expired');
                    return;
                  }
                  if (!accepting || ws.readyState !== WebSocket.OPEN) return;
                  const parsed = ClientEvent.safeParse(parseJson(data.toString()));
                  if (!parsed.success) throw new AppError('VALIDATION', 400);
                  const event = parsed.data;
                  if (event.type === 'presence.visibility')
                    peer.foreground = event.payload.foreground;
                  const result = await dispatch(user.userId, event);
                  if (event.type === 'match.subscribe' && result && 'phase' in result) {
                    if (peer.room && peer.room !== event.payload.matchId) {
                      const old = peer.room;
                      peer.room = null;
                      if (!rooms.connected(old, user.userId))
                        await presence(user.userId, old, false);
                    }
                    peer.room = event.payload.matchId;
                    await presence(user.userId, peer.room, true);
                    await rooms.sendAuthorized(peer, { type: 'match.snapshot', payload: result });
                  } else if (event.type === 'ping' && peer.room)
                    await presence(user.userId, peer.room, true);
                } catch (error) {
                  const app = error instanceof AppError ? error : new AppError('INTERNAL', 500);
                  await rooms.sendAuthorized(peer, {
                    type: 'error',
                    payload: {
                      code: app.httpStatus >= 500 ? 'INTERNAL' : app.code,
                      message: app.httpStatus >= 500 ? 'Service unavailable' : app.safeMessage,
                    },
                  });
                  if (app.code === 'VALIDATION' && ++violations >= 3)
                    ws.close(1008, 'Invalid messages');
                }
              })
              .catch(() => {
                ws.close(1011, 'Connection failed');
              })
              .finally(() => {
                pending--;
              });
          });
          ws.on('close', () => {
            accepting = false;
            rooms.peers.delete(peer);
            if (peer.room && !rooms.connected(peer.room, user.userId))
              void presence(user.userId, peer.room, false).catch(() => {});
          });
        });
      } catch (error) {
        const status = error instanceof AppError ? error.httpStatus : 401;
        socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);
        socket.destroy();
      }
    })();
  });
  const heartbeat = setInterval(() => {
    for (const p of rooms.peers) {
      if (!p.alive) {
        p.socket.terminate();
        continue;
      }
      p.alive = false;
      p.socket.ping();
      void p
        .authorize(true)
        .then((valid) => {
          if (!valid) p.socket.close(1008, 'Session expired');
        })
        .catch(() => p.socket.close(1011, 'Session check failed'));
    }
    upgrades.cleanup();
  }, 30000);
  heartbeat.unref();
  return {
    close: async () => {
      clearInterval(heartbeat);
      for (const p of rooms.peers) p.socket.close(1001, 'Server shutdown');
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
