import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceCard, PublicMatchView, ServerEvent } from '@scalesquad/shared';
import { useMatch } from '../../src/features/lobby/useMatch';
import { fixture } from '../server/fakes';
import { deferred } from '../helpers/deferred';

const mock = vi.hoisted(() => ({
  api: vi.fn(),
  receivers: [] as ((event: ServerEvent) => void)[],
}));
vi.mock('@/lib/api/client', () => ({ api: mock.api }));
vi.mock('@/lib/ws/client', () => ({
  WsClient: class {
    constructor(_url: string, receive: (event: ServerEvent) => void) {
      mock.receivers.push(receive);
    }
    connect() {}
    close() {}
    send() {}
  },
}));
afterEach(() => {
  cleanup();
  mock.api.mockReset();
  mock.receivers.length = 0;
});

describe('match request ownership', () => {
  it('rejects a late old-match response and socket snapshot even with a higher revision', async () => {
    const f = fixture(),
      first = await f.match.createMatch('a'),
      second = await f.match.createMatch('b');
    const old = deferred<PublicMatchView>();
    mock.api.mockImplementation((path: string) =>
      path === `/matches/${first.id}` ? old.promise : Promise.resolve(second),
    );
    const hook = renderHook(({ id }) => useMatch(id), { initialProps: { id: first.id } });
    const oldReceive = mock.receivers[0]!;
    hook.rerender({ id: second.id });
    await waitFor(() => expect(hook.result.current.view?.id).toBe(second.id));
    await act(async () => {
      old.resolve({ ...first, revision: 999 });
      await old.promise;
    });
    act(() =>
      oldReceive({
        v: 1,
        id: 'late',
        type: 'match.snapshot',
        payload: { ...first, revision: 1000 },
      }),
    );
    expect(hook.result.current.view?.id).toBe(second.id);
    act(() =>
      mock.receivers[1]!({
        v: 1,
        id: 'current',
        type: 'match.snapshot',
        payload: { ...second, revision: 1 },
      }),
    );
    expect(hook.result.current.view?.revision).toBe(1);
  });
  it('keeps newest evidence when responses arrive out of order', async () => {
    const f = fixture(),
      id = await f.briefing(),
      view = await f.match.getPublicView('a', id);
    const old = deferred<EvidenceCard[]>(),
      latest = deferred<EvidenceCard[]>();
    mock.api
      .mockResolvedValueOnce(view)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    const hook = renderHook(() => useMatch(id));
    await waitFor(() => expect(mock.api).toHaveBeenCalledTimes(2));
    act(() =>
      mock.receivers[0]!({
        v: 1,
        id: 'e',
        type: 'evidence.available',
        payload: { phase: 'BRIEFING' },
      }),
    );
    const cards = await f.evidence.get('a', id);
    await act(async () => {
      latest.resolve(cards);
      await latest.promise;
    });
    await act(async () => {
      old.resolve([]);
      await old.promise;
    });
    expect(hook.result.current.cards).toEqual(cards);
  });
  it('reports a committed command as successful when only its refresh fails', async () => {
    const view = await fixture().match.createMatch('a');
    mock.api
      .mockResolvedValueOnce(view)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('offline'));
    const hook = renderHook(() => useMatch(view.id));
    await waitFor(() => expect(hook.result.current.view).not.toBeNull());
    let success = false;
    await act(async () => {
      success = await hook.result.current.action('/ready', { ready: true });
    });
    expect(success).toBe(true);
    expect(hook.result.current.error).toContain('Action saved');
    expect(hook.result.current.busy).toBe(false);
  });
  it('does not unlock a new command when an abandoned match command settles', async () => {
    const f = fixture(),
      first = await f.match.createMatch('a'),
      second = await f.match.createMatch('b');
    const old = deferred<unknown>(),
      current = deferred<unknown>();
    mock.api.mockImplementation((path: string) => {
      if (path === `/matches/${first.id}/ready`) return old.promise;
      if (path === `/matches/${second.id}/ready`) return current.promise;
      return Promise.resolve(path === `/matches/${first.id}` ? first : second);
    });
    const hook = renderHook(({ id }) => useMatch(id), { initialProps: { id: first.id } });
    await waitFor(() => expect(hook.result.current.view).not.toBeNull());
    let previous!: Promise<boolean>, pending!: Promise<boolean>;
    act(() => {
      previous = hook.result.current.action('/ready');
    });
    hook.rerender({ id: second.id });
    await waitFor(() => expect(hook.result.current.view?.id).toBe(second.id));
    act(() => {
      pending = hook.result.current.action('/ready');
    });
    await act(async () => {
      old.reject(new Error('late'));
      await previous;
    });
    expect(hook.result.current.pendingAction).toBe('/ready');
    expect(hook.result.current.error).toBe('');
    await act(async () => {
      current.resolve({});
      await pending;
    });
    expect(hook.result.current.busy).toBe(false);
  });
  it('aborts transport work and ignores late errors after unmount', async () => {
    const pending = deferred<unknown>();
    mock.api.mockReturnValue(pending.promise);
    const hook = renderHook(() => useMatch('room'));
    const signal = (mock.api.mock.calls[0]![2] as { signal: AbortSignal }).signal;
    hook.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      pending.reject(new Error('late'));
    });
  });
});
