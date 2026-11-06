import { afterEach, describe, it, expect, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionService } from '../../../src/server/services/sessionService';
import { createWsController } from '../../../src/server/controllers/wsController';
import { fixture } from '../fakes';
import { attachGateway } from '../../../src/server/ws/gateway';
import { Rooms } from '../../../src/server/ws/rooms';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
  vi.useRealTimers();
});
async function setup(development = false) {
  const f = fixture();
  const id = await f.repair(),
    rooms = new Rooms(
      async (user, id) => (await f.repo.find(id))?.members.some((m) => m.userId === user) ?? false,
    ),
    server: Server = createServer();
  const session = new SessionService(
    {
      async find(token) {
        return ['a', 'b', 'c', 'd'].includes(token)
          ? { userId: token, name: token, expires: 999999 }
          : null;
      },
    },
    f.clock,
  );
  const gateway = attachGateway(
    server,
    'http://game.example',
    session,
    createWsController(f.services),
    rooms,
    (u, id, on) => f.lock.presence(u, id, on),
    [],
    { development },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('No port');
  cleanup.push(async () => {
    for (const p of rooms.peers) p.socket.terminate();
    await gateway.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const connect = (
    user: string | null = 'a',
    origin = 'http://game.example',
    path = '/ws',
    host = 'game.example',
  ) =>
    new WebSocket(`ws://127.0.0.1:${addr.port}${path}`, {
      headers: { origin, host, ...(user ? { Cookie: `authjs.session-token=${user}` } : {}) },
    });
  return { ...f, id, rooms, connect, gateway, server };
}
describe('authenticated WebSocket gateway', () => {
  it('rejects a frame flood while authorization is slow and drops queued actions', async () => {
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    const peer = [...f.rooms.peers][0]!;
    let release!: (valid: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    const authorize = vi.spyOn(peer, 'authorize').mockImplementationOnce(() => pending);
    const dispatch = vi.spyOn(f.match, 'getPublicView');
    socket.send(
      JSON.stringify({
        v: 1,
        id: 'subscribe',
        type: 'match.subscribe',
        payload: { matchId: f.id },
      }),
    );
    await vi.waitFor(() => expect(authorize).toHaveBeenCalled());
    const closed = once(socket, 'close');
    const limited = new Promise<void>((resolve) => {
      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw)) as { type: string; payload: { code?: string } };
        if (event.type === 'error' && event.payload.code === 'RATE_LIMITED') resolve();
      });
    });
    try {
      for (let i = 0; i < 200; i++)
        socket.send(JSON.stringify({ v: 1, id: 'ping', type: 'ping', payload: {} }));
      await limited;
      expect((await closed)[0]).toBe(1008);
    } finally {
      release(true);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(dispatch).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalledTimes(2);
  });
  it('leaves only the same-origin development reload channel to Next', async () => {
    const f = await setup(true);
    const next = new WebSocketServer({ noServer: true });
    f.server.on('upgrade', (req, socket, head) => {
      if (!socket.destroyed && req.url?.split('?')[0] === '/_next/hmr')
        next.handleUpgrade(req, socket, head, (ws) => ws.send('dev-ready'));
    });
    cleanup.unshift(async () => {
      for (const client of next.clients) client.terminate();
      await new Promise<void>((resolve) => next.close(() => resolve()));
    });
    const socket = f.connect(null, 'http://game.example', '/_next/hmr?client=1');
    const message = once(socket, 'message');
    await once(socket, 'open');
    expect(String((await message)[0])).toBe('dev-ready');
    expect(f.rooms.peers.size).toBe(0);
    socket.terminate();
    for (const [origin, path, host] of [
      ['http://evil.example', '/_next/hmr', 'game.example'],
      ['http://game.example', '/_next/hmr-extra', 'game.example'],
      ['http://game.example', '/_next/hmr', 'evil.example'],
      ['http://game.example', '/ws', 'game.example'],
    ]) {
      const rejected = f.connect(null, origin, path, host);
      expect(String((await once(rejected, 'error'))[0])).toMatch(/401|403/);
      rejected.terminate();
    }
  });
  it('idle expired sessions close without client messages or further pushes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    f.clock.value = 999999;
    const closed = once(socket, 'close');
    await vi.advanceTimersByTimeAsync(30000);
    expect((await closed)[0]).toBe(1008);
  });
  it('logout closes only the matching session immediately', async () => {
    const f = await setup(),
      a = f.connect('a'),
      b = f.connect('b');
    await Promise.all([once(a, 'open'), once(b, 'open')]);
    const closed = once(a, 'close');
    f.rooms.revokeSession('a');
    expect((await closed)[0]).toBe(1008);
    expect(b.readyState).toBe(WebSocket.OPEN);
    b.terminate();
  });
  it('heartbeat pings connected peers and drops a dead connection', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    const peer = [...f.rooms.peers][0]!;
    const ping = vi.spyOn(peer.socket, 'ping').mockImplementation(() => {});
    await vi.advanceTimersByTimeAsync(30000);
    expect(ping).toHaveBeenCalledOnce();
    const closed = once(socket, 'close');
    await vi.advanceTimersByTimeAsync(30000);
    expect((await closed)[0]).toBe(1006);
  });
  it('room changes stop old-room delivery, and broadcasts recheck membership', async () => {
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    const subscribe = async (id: string) => {
      const next = once(socket, 'message');
      socket.send(
        JSON.stringify({
          v: 1,
          id: 'subscribe',
          type: 'match.subscribe',
          payload: { matchId: id },
        }),
      );
      await next;
    };
    await subscribe(f.id);
    const other = await f.match.createMatch('a');
    await subscribe(other.id);
    expect(
      (await f.repo.find(f.id))?.members.find((m) => m.userId === 'a')?.disconnectedAt,
    ).not.toBeNull();
    const next = once(socket, 'message');
    await f.rooms.broadcast(other.id, { type: 'match.members', payload: { matchId: other.id } });
    expect(JSON.parse(String((await next)[0])).type).toBe('match.members');
    await f.rooms.sendToUser(other.id, 'outsider', {
      type: 'evidence.available',
      payload: { phase: 'BRIEFING' },
    });
    await f.repo.delete(other.id);
    await f.rooms.broadcast(other.id, { type: 'match.members', payload: { matchId: other.id } });
    socket.terminate();
  });
  it('per-connection message limits and internal errors stay safe', async () => {
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    vi.spyOn(f.match, 'getPublicView').mockRejectedValueOnce(new Error('private backend detail'));
    const next = once(socket, 'message');
    socket.send(
      JSON.stringify({ v: 1, id: 'r', type: 'match.subscribe', payload: { matchId: f.id } }),
    );
    const error = JSON.parse(String((await next)[0])) as {
      payload: { code: string; message: string };
    };
    expect(error.payload).toEqual({ code: 'INTERNAL', message: 'Service unavailable' });
    const limited = new Promise<void>((resolve) =>
      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw)) as { type: string; payload: { code?: string } };
        if (event.type === 'error' && event.payload.code === 'RATE_LIMITED') resolve();
      }),
    );
    for (let i = 0; i < 32; i++)
      socket.send(JSON.stringify({ v: 1, id: 'ping', type: 'ping', payload: {} }));
    await limited;
    socket.terminate();
  });
  it('rejects wrong origin, path, missing and expired sessions', async () => {
    const f = await setup();
    for (const args of [
      [null, 'http://game.example', '/ws'],
      ['expired', 'http://game.example', '/ws'],
      ['a', 'http://evil.example', '/ws'],
      ['a', 'http://game.example', '/other'],
      [null, 'http://game.example', '/_next/hmr'],
    ] as const) {
      const socket = f.connect(...args);
      const [error] = await once(socket, 'error');
      expect(String(error)).toMatch(/401|403/);
      socket.terminate();
    }
  });
  it('membership-checked subscribe, private own-user routing and logout on an open socket', async () => {
    const f = await setup(),
      a = f.connect('a'),
      b = f.connect('b');
    await Promise.all([once(a, 'open'), once(b, 'open')]);
    const send = (socket: WebSocket, type: string, payload: unknown) =>
      socket.send(JSON.stringify({ v: 1, type, id: 'request', payload }));
    let next = once(a, 'message');
    send(a, 'match.subscribe', { matchId: f.id });
    const [snapshot] = await next;
    expect(JSON.parse(String(snapshot)).type).toBe('match.snapshot');
    next = once(b, 'message');
    send(b, 'match.subscribe', { matchId: f.id });
    await next;
    next = once(a, 'message');
    f.rooms.sendToUser(f.id, 'a', { type: 'evidence.available', payload: { phase: 'BRIEFING' } });
    expect(JSON.parse(String((await next)[0])).payload).toEqual({ phase: 'BRIEFING' });
    const outsider = f.connect('d');
    await once(outsider, 'open');
    next = once(outsider, 'message');
    send(outsider, 'match.subscribe', { matchId: f.id });
    expect(JSON.parse(String((await next)[0])).payload.code).toBe('FORBIDDEN');
    f.clock.value = 999999;
    const closed = once(a, 'close');
    send(a, 'ping', {});
    expect((await closed)[0]).toBe(1008);
    b.terminate();
    outsider.terminate();
  });
  it('invalid envelopes error then close; oversized frames are rejected', async () => {
    const f = await setup(),
      socket = f.connect();
    await once(socket, 'open');
    for (const data of [
      '{',
      JSON.stringify({ v: 1, type: 'unknown', id: 'r', payload: {} }),
      JSON.stringify({ v: 1, type: 'ping', id: 'r', payload: { extra: 1 } }),
    ]) {
      const msg = once(socket, 'message');
      socket.send(data);
      expect(JSON.parse(String((await msg)[0])).type).toBe('error');
    }
    const huge = f.connect('b');
    await once(huge, 'open');
    huge.on('error', () => {});
    const closed = once(huge, 'close');
    huge.send('x'.repeat(17000));
    expect((await closed)[0]).toBe(1009);
  });
});
