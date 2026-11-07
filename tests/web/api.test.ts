import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/lib/api/client';
import { clientErrorMessage } from '../../src/lib/api/errors';
import { AppError } from '../../src/shared/errors';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('safe API client errors', () => {
  it('uses friendly conflict messages for typed API and older WebSocket errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'LOCK_NOT_HELD', message: 'LOCK_NOT_HELD' } }),
            { status: 409 },
          ),
        ),
    );
    await expect(api('/matches/a/config', {})).rejects.toMatchObject({
      code: 'LOCK_NOT_HELD',
      httpStatus: 409,
      message: expect.stringContaining('teammate'),
    });
    expect(clientErrorMessage(new Error('PHASE_INVALID'))).toContain('stage');
    expect(clientErrorMessage(new AppError('VERSION_CONFLICT'))).toContain('configuration');
  });
  it.each([502, 503])('hides HTML proxy error bodies at status %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>private proxy diagnostic</html>', { status })),
    );
    await expect(api('/matches/a')).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      httpStatus: status,
      message: expect.not.stringContaining('private proxy'),
    });
  });
  it('preserves rate limiting and Retry-After even when the proxy returns plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('Too many requests', { status: 429, headers: { 'Retry-After': '25' } }),
        ),
    );
    await expect(api('/auth/login', {})).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      httpStatus: 429,
      retryAfterSeconds: 25,
    });
  });
  it('reports unreadable success JSON as an upstream error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    await expect(api('/matches/a')).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      httpStatus: 502,
    });
  });
  it('aborts a stalled request and clears its timeout after completion', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          (_url: unknown, init: RequestInit) =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              ),
            ),
        ),
    );
    const pending = expect(api('/matches/a', undefined, { timeoutMs: 100 })).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      message: expect.stringContaining('too long'),
    });
    await vi.advanceTimersByTimeAsync(101);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not expose network exception details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private URL or OS exception')));
    await expect(api('/matches/a')).rejects.toMatchObject({
      message: 'Cannot reach the service. Check your connection and try again.',
    });
  });
});
