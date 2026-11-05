import { describe, it, expect, vi } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { WebPushTransport } from '../../../src/server/lib/webPushTransport';
import { validVapid } from '../../../src/server/config/vapid';
import { readEnv } from '../../../src/server/config/env';
describe('real Web Push adapter contract', () => {
  const keys = webpush.generateVAPIDKeys(),
    vapid = { ...keys, subject: 'mailto:admin@example.invalid' };
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/send/test-only',
    keys: {
      p256dh: curve.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
  const payload = JSON.stringify({ kind: 'MATCH_STARTED', matchId: 'match1' });
  it('sends validated content-free data with encryption, TTL and socket timeout', async () => {
    const send = vi.fn(async () => ({ statusCode: 201, headers: {}, body: '' }));
    const adapter = new WebPushTransport(vapid, send);
    await adapter.send(subscription, payload);
    expect(send).toHaveBeenCalledWith(
      subscription,
      payload,
      expect.objectContaining({
        TTL: 60,
        timeout: 5000,
        contentEncoding: 'aes128gcm',
        vapidDetails: vapid,
      }),
    );
    const request = webpush.generateRequestDetails(subscription, payload, {
      vapidDetails: vapid,
      contentEncoding: 'aes128gcm',
    });
    expect(request.method).toBe('POST');
    expect(request.body?.toString()).not.toContain(payload);
    expect(request.headers).toHaveProperty('Authorization');
  });
  it('rejects stored SSRF targets and extra private data before making requests', async () => {
    const send = vi.fn(async () => ({ statusCode: 201, headers: {}, body: '' })),
      adapter = new WebPushTransport(vapid, send);
    await expect(
      adapter.send({ ...subscription, endpoint: 'https://127.0.0.1/' }, payload),
    ).rejects.toThrow();
    await expect(
      adapter.send(
        subscription,
        JSON.stringify({ kind: 'EVIDENCE_AVAILABLE', matchId: 'a', evidence: 'private' }),
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it('accepts matching keys and safe contact URIs, rejects malformed and mismatched keys', () => {
    expect(validVapid(keys.publicKey, keys.privateKey, vapid.subject)).toBe(true);
    expect(validVapid(keys.publicKey, keys.privateKey, 'https://example.invalid/contact')).toBe(
      true,
    );
    for (const subject of [
      'http://example.invalid',
      'https://localhost',
      'https://user:pass@example.invalid',
      'mailto:invalid',
      'mailto:admin@example.invalid?body=x',
      'bad',
    ])
      expect(validVapid(keys.publicKey, keys.privateKey, subject)).toBe(false);
    expect(validVapid(keys.publicKey, webpush.generateVAPIDKeys().privateKey, vapid.subject)).toBe(
      false,
    );
    expect(validVapid('bad', 'bad', vapid.subject)).toBe(false);
  });
  it('boot config requires all VAPID fields and never exposes values in errors', () => {
    const env = {
      DATABASE_URL: 'postgresql://example.invalid/db',
      DIRECT_URL: 'postgresql://example.invalid/db',
      AUTH_SECRET: 'x'.repeat(32),
      APP_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'test',
    };
    expect(
      readEnv({
        ...env,
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: vapid.subject,
      }).VAPID_PUBLIC_KEY,
    ).toBe(keys.publicKey);
    expect(() => readEnv({ ...env, VAPID_PUBLIC_KEY: keys.publicKey })).toThrow('VAPID_PUBLIC_KEY');
  });
});
