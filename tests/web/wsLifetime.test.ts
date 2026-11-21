import { afterEach, describe, expect, it, vi } from 'vitest';
import { WsClient } from '../../src/lib/ws/client';

function socket() {
  return {
    readyState: 1,
    onopen: null as (() => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    close: vi.fn(),
    send: vi.fn(),
  };
}
afterEach(() => {
  vi.useRealTimers();
});
describe('socket connection lifetime', () => {
  it('connects once, ignores stale events, and cancels heartbeat and reconnect on close', async () => {
    vi.useFakeTimers();
    const first = socket(),
      second = socket(),
      receive = vi.fn(),
      status = vi.fn();
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const client = new WsClient('ws://test', receive, status, factory, () => 0.5);
    client.connect();
    client.connect();
    expect(factory).toHaveBeenCalledOnce();
    first.onopen!();
    await vi.advanceTimersByTimeAsync(20000);
    expect(first.send).toHaveBeenCalledOnce();
    first.onclose!();
    await vi.advanceTimersByTimeAsync(500);
    second.onopen!();
    first.onclose!();
    first.onopen!();
    first.onmessage!({
      data: JSON.stringify({ v: 1, id: 'old', type: 'hello', payload: { userId: 'a' } }),
    });
    expect(receive).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(2);
    client.close();
    client.close();
    second.onclose!();
    second.onopen!();
    await vi.advanceTimersByTimeAsync(60000);
    expect(vi.getTimerCount()).toBe(0);
    expect(second.close).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('offline');
  });
  it('retries a synchronous construction failure and cancels a pending retry', async () => {
    vi.useFakeTimers();
    const factory = vi.fn(() => {
      throw new Error('not available');
    });
    const status = vi.fn(),
      client = new WsClient('ws://test', vi.fn(), status, factory, () => 0.5);
    client.connect();
    expect(status).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(500);
    expect(factory).toHaveBeenCalledTimes(2);
    client.close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
