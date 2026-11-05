import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
function worker() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {},
    storage = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => (typeof r === 'string' ? r : r.url);
  const caches = {
    keys: async () => [...storage.keys()],
    delete: vi.fn(async (name: string) => storage.delete(name)),
    match: async (request: Request | string) => {
      for (const cache of storage.values()) {
        const response = cache.get(key(request));
        if (response) return response.clone();
      }
      return undefined;
    },
    open: async (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      const values = storage.get(name)!;
      return {
        put: async (request: Request | string, response: Response) => {
          values.set(key(request), response.clone());
        },
        match: async (request: Request | string) => values.get(key(request))?.clone(),
      };
    },
  };
  const fetch = vi.fn(
      async (_request: unknown, _options?: unknown) =>
        new Response('static offline shell', { headers: { 'Content-Type': 'text/html' } }),
    ),
    showNotification = vi.fn(async () => {}),
    skipWaiting = vi.fn(async () => {}),
    openWindow = vi.fn(async () => {}),
    focus = vi.fn(async () => {});
  const self = {
    location: { origin: 'https://game.example' },
    addEventListener: (type: string, handler: (e: Record<string, unknown>) => void) => {
      handlers[type] = handler;
    },
    skipWaiting,
    registration: { showNotification },
    clients: {
      claim: vi.fn(async () => {}),
      openWindow,
      matchAll: vi.fn(async () => [{ url: 'https://game.example/match/m1', focus }]),
    },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, caches, fetch, URL, Response });
  async function dispatch(type: string, props: Record<string, unknown> = {}) {
    let pending: Promise<unknown> | undefined, result: Promise<Response> | undefined;
    handlers[type]!({
      ...props,
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
      respondWith: (p: Promise<Response>) => {
        result = p;
      },
    });
    await pending;
    return result ? await result : undefined;
  }
  return {
    dispatch,
    storage,
    caches,
    fetch,
    self,
    skipWaiting,
    showNotification,
    openWindow,
    focus,
  };
}
describe('generated service worker behavior', () => {
  it('waits for user-approved updates, removes old caches and acknowledges purge', async () => {
    const w = worker();
    w.storage.set('old', new Map());
    await w.dispatch('install');
    expect(w.skipWaiting).not.toHaveBeenCalled();
    await w.dispatch('activate');
    expect(w.storage.has('old')).toBe(false);
    expect(w.storage.size).toBe(1);
    await w.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(w.skipWaiting).toHaveBeenCalledOnce();
    const ack = vi.fn();
    await w.dispatch('message', { data: { type: 'PURGE' }, ports: [{ postMessage: ack }] });
    expect(w.storage.size).toBe(0);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });
  it('navigation uses network first, falls back to a static shell and never caches private HTML', async () => {
    const w = worker();
    await w.dispatch('install');
    const request = { method: 'GET', url: 'https://game.example/match/private', mode: 'navigate' };
    w.fetch.mockResolvedValueOnce(new Response('private user data'));
    expect(await (await w.dispatch('fetch', { request }))!.text()).toBe('private user data');
    expect([...w.storage.values()].some((cache) => cache.has(request.url))).toBe(false);
    w.fetch.mockRejectedValueOnce(new Error('offline'));
    expect(await (await w.dispatch('fetch', { request }))!.text()).toBe('static offline shell');
    await w.dispatch('message', { data: { type: 'PURGE' }, ports: [] });
    w.fetch.mockRejectedValueOnce(new Error('offline'));
    expect((await w.dispatch('fetch', { request }))!.status).toBe(503);
    for (const path of ['/api/game/me', '/api/auth/session', '/ws'])
      expect(
        await w.dispatch('fetch', {
          request: { method: 'GET', url: `https://game.example${path}`, mode: 'cors' },
        }),
      ).toBeUndefined();
    expect(
      await w.dispatch('fetch', {
        request: { method: 'POST', url: 'https://game.example/api/game/auth/login', mode: 'cors' },
      }),
    ).toBeUndefined();
  });
  it('caches approved static GETs only after checking response headers', async () => {
    const w = worker(),
      request = { method: 'GET', url: 'https://game.example/_next/static/hash.js', mode: 'cors' };
    w.fetch.mockResolvedValueOnce(
      new Response('asset', { headers: { 'Content-Type': 'application/javascript' } }),
    );
    await w.dispatch('fetch', { request });
    const count = w.fetch.mock.calls.length;
    await w.dispatch('fetch', { request });
    expect(w.fetch).toHaveBeenCalledTimes(count);
    const sensitive = { ...request, url: 'https://game.example/_next/static/sensitive.js' };
    w.fetch.mockResolvedValueOnce(
      new Response('secret', { headers: { 'Cache-Control': 'no-store' } }),
    );
    await w.dispatch('fetch', { request: sensitive });
    expect([...w.storage.values()].some((cache) => cache.has(sensitive.url))).toBe(false);
  });
  it('notification contents are fixed and clicks stay within the match path', async () => {
    const w = worker();
    await w.dispatch('push', {
      data: { json: () => ({ kind: 'EVIDENCE_AVAILABLE', matchId: 'm1' }) },
    });
    expect(w.showNotification).toHaveBeenCalledWith(
      'ScaleSquad',
      expect.objectContaining({ body: 'New private evidence is ready.', data: { matchId: 'm1' } }),
    );
    await w.dispatch('push', {
      data: { json: () => ({ kind: 'EVIDENCE_AVAILABLE', matchId: 'm1', evidence: 'secret' }) },
    });
    expect(w.showNotification).toHaveBeenCalledOnce();
    await w.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { matchId: 'm1' } },
    });
    expect(w.focus).toHaveBeenCalledOnce();
    w.self.clients.matchAll.mockResolvedValueOnce([]);
    await w.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { matchId: 'm2' } },
    });
    expect(w.openWindow).toHaveBeenCalledWith('https://game.example/match/m2');
  });
});
