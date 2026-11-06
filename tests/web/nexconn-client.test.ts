import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NexconnClient } from '../../src/lib/nexconn/client';

const sdk = vi.hoisted(() => ({
  connect: vi.fn(async (_access: { token: string }) => ({ code: 0 })),
  disconnect: vi.fn(async () => {}),
  addMessageHandler: vi.fn(),
  removeMessageHandler: vi.fn(),
  history: vi.fn(async () => ({ code: 0, data: { data: [] } })),
  send: vi.fn(async (_value: unknown) => ({ code: 0 })),
}));
vi.mock('@nexconn/chat', () => ({
  AreaCode: { SG: 'SG', NA: 'NA', SA: 'SA' },
  LogLevel: { ERROR: 'ERROR' },
  NCEngine: { initialize: vi.fn(), ...sdk },
  GroupChannel: class {
    constructor(readonly id: string) {}
    get identifier() {
      return { channelId: this.id };
    }
    sendMessage = sdk.send;
  },
  BaseChannel: { createMessagesQuery: () => ({ loadNextPage: sdk.history }) },
  MessageHandler: class {},
  SendTextMessageParams: class {},
}));

const clients: NexconnClient[] = [];
const access = (token: string) => ({
  token,
  appKey: 'test-key',
  groupRef: token,
  region: 'SG' as const,
});
function client() {
  const value = new NexconnClient();
  clients.push(value);
  return value;
}
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  await Promise.all(clients.splice(0).map((value) => value.close()));
});

describe('single-engine chat lifecycle', () => {
  it('finishes old cleanup before connecting a replacement and ignores repeated old cleanup', async () => {
    let release!: (value: { code: number }) => void;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const old = client(),
      next = client();
    const opening = old.connect(access('old'), vi.fn());
    await vi.waitFor(() => expect(sdk.connect).toHaveBeenCalledOnce());
    const closing = old.close();
    const replacement = next.connect(access('next'), vi.fn());
    release({ code: 0 });
    await Promise.all([opening, closing, replacement]);
    expect(sdk.connect.mock.calls.map(([value]) => value.token)).toEqual(['old', 'next']);
    expect(sdk.disconnect).toHaveBeenCalledOnce();
    expect(sdk.history).toHaveBeenCalledOnce();
    await old.close();
    expect(sdk.disconnect).toHaveBeenCalledOnce();
    await next.send('Still connected');
    expect(sdk.send).toHaveBeenCalledOnce();
    await expect(old.send('Old connection')).rejects.toThrow();
  });
  it('removes failed connection handlers and lets the next connection succeed', async () => {
    sdk.connect.mockResolvedValueOnce({ code: 1 });
    await expect(client().connect(access('failed'), vi.fn())).rejects.toThrow(
      'Chat connection failed',
    );
    expect(sdk.removeMessageHandler).toHaveBeenCalledOnce();
    expect(sdk.disconnect).toHaveBeenCalledOnce();
    await client().connect(access('next'), vi.fn());
    expect(sdk.history).toHaveBeenCalledOnce();
  });
  it('replaces the prior owner without letting it disconnect the new owner', async () => {
    const old = client(),
      next = client();
    await old.connect(access('old'), vi.fn());
    await next.connect(access('next'), vi.fn());
    expect(sdk.disconnect).toHaveBeenCalledOnce();
    await old.close();
    expect(sdk.disconnect).toHaveBeenCalledOnce();
    await next.send('Hello');
    expect(sdk.send).toHaveBeenCalledOnce();
  });
});
