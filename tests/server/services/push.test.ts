import { describe, it, expect, vi } from 'vitest';
import { allowedPushEndpoint, type PushSubscriptionDto } from '@scalesquad/shared';
import { PushService } from '../../../src/server/services/pushService';
import type { PushRecord } from '../../../src/server/lib/push';
import { pushControllers } from '../../../src/server/controllers/pushController';
describe('private bounded push delivery', () => {
  it.each([
    'https://fcm.googleapis.com/send/a',
    'https://updates.push.services.mozilla.com/wpush/a',
    'https://web.push.apple.com/a',
    'https://a.notify.windows.com/a',
  ])('accepts trusted push URL %s', (value) => expect(allowedPushEndpoint(value)).toBe(true));
  it.each([
    'http://fcm.googleapis.com/a',
    'https://user@fcm.googleapis.com/a',
    'https://fcm.googleapis.com:8443/a',
    'https://127.0.0.1/a',
    'https://[::1]/a',
    'https://localhost/a',
    'https://10.0.0.1/a',
    'https://fcm.googleapis.com.evil.com/a',
    'https://evilpush.apple.com/a',
    'nonsense',
    'https://fcm.googleapis.com/' + 'a'.repeat(2048),
  ])('rejects SSRF target %s', (value) => expect(allowedPushEndpoint(value)).toBe(false));
  it('sends exactly kind + matchId to the owner and drops only dead subscriptions', async () => {
    const a: PushRecord = {
      id: 'a',
      userId: 'a',
      endpoint: 'https://fcm.googleapis.com/send/a',
      keys: { p256dh: 'test', auth: 'test' },
    };
    const repo = {
        save: vi.fn(async () => {}),
        list: vi.fn(async () => [a]),
        remove: vi.fn(async () => {}),
      },
      transport = {
        send: vi.fn(async (_subscription: PushSubscriptionDto, _payload: string) => {}),
      };
    const service = new PushService(repo, transport, () => false, 'public');
    await service.notify('a', 'EVIDENCE_AVAILABLE', 'match1');
    expect(repo.list).toHaveBeenCalledWith('a');
    expect(JSON.parse(transport.send.mock.calls[0]![1]!)).toEqual({
      kind: 'EVIDENCE_AVAILABLE',
      matchId: 'match1',
    });
    transport.send.mockRejectedValueOnce({ statusCode: 410 });
    await service.notify('a', 'MATCH_STARTED', 'match1');
    expect(repo.remove).toHaveBeenCalledWith('a', a.endpoint);
    transport.send.mockRejectedValueOnce({ statusCode: 503 });
    repo.remove.mockClear();
    await expect(service.notify('a', 'MATCH_STARTED', 'match1')).resolves.toBeUndefined();
    expect(repo.remove).not.toHaveBeenCalled();
    const foreground = new PushService(repo, transport, () => true, 'public');
    transport.send.mockClear();
    await foreground.notify('a', 'RUN_COMPLETED', 'match1');
    expect(transport.send).not.toHaveBeenCalled();
    const disabled = new PushService(repo, null, () => false, '');
    await disabled.notify('a', 'RUN_COMPLETED', 'match1');
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('requires authentication and strict ownership-bound inputs', async () => {
    const repo = {
      save: vi.fn(async () => {}),
      list: vi.fn(async () => []),
      remove: vi.fn(async () => {}),
    };
    const service = new PushService(repo, null, () => false, ''),
      controller = pushControllers(service);
    expect(await controller.pushKey()).toEqual({ publicKey: '' });
    const value: PushSubscriptionDto = {
      endpoint: 'https://fcm.googleapis.com/send/a',
      keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
    };
    await expect(service.subscribe(null, value, '')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(service.unsubscribe(null, value.endpoint)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await controller.pushSubscribe({
      userId: 'a',
      name: 'A',
      matchId: '',
      body: value,
      userAgent: 'x'.repeat(300),
    });
    expect(repo.save).toHaveBeenCalledWith('a', value, 'x'.repeat(200));
    await controller.pushSubscribe({ userId: 'a', name: 'A', matchId: '', body: value });
    await controller.pushUnsubscribe({
      userId: 'b',
      name: 'B',
      matchId: '',
      body: { endpoint: value.endpoint },
    });
    expect(repo.remove).toHaveBeenCalledWith('b', value.endpoint);
    await expect(
      controller.pushSubscribe({
        userId: 'a',
        name: 'A',
        matchId: '',
        body: { ...value, userId: 'b' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
