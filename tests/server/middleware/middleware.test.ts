import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { AppError } from '@scalesquad/shared';
import { originCheck, requestId, securityHeaders } from '../../../src/server/middleware/security';
import { RateLimiter } from '../../../src/server/utils/rateLimit';
import { parseJson, bodyParser } from '../../../src/server/middleware/bodyParser';
import { safeError } from '../../../src/server/middleware/errorHandler';
import { createLogger } from '../../../src/server/infra/logger';
import { SessionService } from '../../../src/server/services/sessionService';
import { readEnv } from '../../../src/server/config/env';
describe('HTTP integrity and limits', () => {
  const origin = 'https://game.example';
  it('allows React debugging only for dev pages, never production or built-test pages', () => {
    expect(securityHeaders(false, origin, true)['Content-Security-Policy']).toContain(
      "'unsafe-eval'",
    );
    expect(securityHeaders(false, origin)['Content-Security-Policy']).not.toContain(
      "'unsafe-eval'",
    );
    expect(securityHeaders(true, origin, true)['Content-Security-Policy']).not.toContain(
      "'unsafe-eval'",
    );
  });
  it('generates fresh IDs, sets CSP and production-only HSTS', () => {
    expect(requestId()).not.toBe(requestId());
    expect(securityHeaders(true, origin)['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(securityHeaders(true, origin)['Strict-Transport-Security']).toBeDefined();
    expect(securityHeaders(false, origin)['Strict-Transport-Security']).toBeUndefined();
    const csp = securityHeaders(true, origin)['Content-Security-Policy']!;
    for (const region of ['sg', 'us', 'sau'])
      for (const protocol of ['https', 'wss'])
        expect(csp).toContain(`${protocol}://*.${region}-light-api.com`);
  });
  it.each(['GET', 'HEAD', 'OPTIONS'])('safe method %s exempt from Origin', (method) =>
    expect(() => originCheck(method, undefined, undefined, origin)).not.toThrow(),
  );
  it.each([
    'http://game.example',
    'https://evil.example',
    'https://game.example:444',
    'null',
    undefined,
  ])('rejects mutation Origin %s', (value) =>
    expect(() => originCheck('POST', value, 'cross-site', origin)).toThrow('Origin not allowed'),
  );
  it('exact origin or same-origin metadata accepted; cross-site cannot spoof fallback', () => {
    expect(() => originCheck('POST', origin, undefined, origin)).not.toThrow();
    expect(() => originCheck('POST', undefined, 'same-origin', origin)).not.toThrow();
    expect(() => originCheck('POST', 'null', 'same-origin', origin)).toThrow();
  });
  it('token bucket burst, partial refill, separate keys and cleanup', () => {
    let time = 0;
    const r = new RateLimiter(2, 1, () => time);
    r.take('a');
    r.take('a');
    expect(() => r.take('a')).toThrow('Try again in 1 seconds');
    r.take('b');
    time = 500;
    expect(() => r.take('a')).toThrow();
    time = 1500;
    r.take('a');
    time = 120000;
    r.cleanup();
    expect(r.size).toBe(0);
    r.take('x');
    expect(r.size).toBe(1);
  });
  it('cleanup bounds a large map', () => {
    let t = 0;
    const r = new RateLimiter(1, 1, () => t);
    for (let i = 0; i < 10000; i++) r.take(String(i));
    t = 120000;
    r.take('new');
    expect(r.size).toBe(1);
  });
  it('bounds fresh keys without globally denying arrivals or resetting active quotas', () => {
    let time = 0;
    const limiter = new RateLimiter(1, 1, () => time, 2);
    const cleanup = vi.spyOn(limiter, 'cleanup');
    limiter.take('a');
    limiter.take('b');
    expect(() => limiter.take('new')).not.toThrow();
    expect(() => limiter.take('new')).toThrow();
    for (let i = 0; i < 2000; i++) {
      try {
        limiter.take(`new-${i}`);
      } catch {
        /* Overflow partitions retain quotas. */
      }
    }
    expect(limiter.size).toBeLessThanOrEqual(1026);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(() => limiter.take('a')).toThrow();
    time = 60000;
    limiter.take('new');
    expect(limiter.size).toBe(1);
  });
  it('safe errors expose neither internal exceptions nor their causes', () => {
    expect(safeError(new Error('secret SQL'), 'req')).toEqual({
      status: 500,
      body: {
        error: {
          code: 'INTERNAL',
          message: 'Service unavailable. Please try again.',
          requestId: 'req',
        },
      },
    });
    expect(safeError(new AppError('FORBIDDEN', 403), 'req').status).toBe(403);
  });
  it('JSON rejects prototype pollution and malformed values', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    for (const key of ['__proto__', 'constructor', 'prototype'])
      expect(() => parseJson(`{"${key}":{}}`)).toThrow('Invalid JSON');
    expect(() => parseJson('{')).toThrow();
  });
  it('streaming body cap, declared length, content type, invalid JSON and proper parsing', async () => {
    const request = (parts: unknown[], headers: Record<string, string>) =>
      Object.assign(Readable.from(parts), { headers }) as unknown as IncomingMessage;
    expect(
      await bodyParser(
        request([Buffer.from('{"a":1}')], { 'content-type': 'application/json; charset=utf-8' }),
      ),
    ).toEqual({ a: 1 });
    await expect(bodyParser(request([], {}))).rejects.toMatchObject({ httpStatus: 415 });
    await expect(
      bodyParser(request([], { 'content-type': 'application/json', 'content-length': '20000' })),
    ).rejects.toMatchObject({ httpStatus: 413 });
    await expect(
      bodyParser(request([Buffer.alloc(20)], { 'content-type': 'application/json' }), 10),
    ).rejects.toMatchObject({ httpStatus: 413 });
    await expect(
      bodyParser(request([Buffer.from('{')], { 'content-type': 'application/json' })),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(
      await bodyParser(
        request([new Uint8Array([123, 125])], { 'content-type': 'application/json' }),
      ),
    ).toEqual({});
  });
  it('logger redacts secrets, cookies, evidence and arbitrary exception messages', () => {
    let text = '';
    const logger = createLogger('info', {
      write: (chunk) => {
        text += chunk;
      },
    });
    logger.info(
      {
        req: { headers: { cookie: 'secret-test-value', authorization: 'secret-test-value' } },
        token: 'secret-test-value',
        secret: 'secret-test-value',
        password: 'secret-test-value',
        currentPassword: 'secret-test-value',
        newPassword: 'secret-test-value',
        VAPID_PRIVATE_KEY: 'secret-test-value',
        vapid: { privateKey: 'secret-test-value' },
        payload: 'secret-test-value',
        evidence: 'secret-test-value',
        nested: { token: 'secret-test-value', payload: 'secret-test-value' },
        err: new Error('secret-test-value'),
      },
      'event',
    );
    expect(text).not.toContain('secret-test-value');
    expect(text).toContain('[Redacted]');
  });
});
describe('database session cookie resolution', () => {
  const repo = {
    find: vi.fn(async (token: string) =>
      token === 'valid'
        ? { userId: 'a', name: 'A', expires: 200 }
        : token === 'expired'
          ? { userId: 'a', name: 'A', expires: 0 }
          : null,
    ),
  };
  const s = new SessionService(repo, { now: () => 100 });
  it.each([
    undefined,
    '',
    'garbage',
    'authjs.session-token=unknown',
    'authjs.session-token=expired',
    'authjs.session-token=%zz',
    'authjs.session-token=',
    'x'.repeat(9000),
    'authjs.session-token=' + 'x'.repeat(600),
  ])('denies garbage/expired input %s', async (value) => {
    expect(await s.resolveFromCookie(value)).toBeNull();
  });
  it.each(['authjs.session-token=valid', 'a=b; __Secure-authjs.session-token=valid; x=y'])(
    'accepts secure and plain cookie %s',
    async (header) => {
      expect(await s.resolveFromCookie(header)).toEqual({ userId: 'a', name: 'A' });
    },
  );
  it('repository errors fail closed', async () => {
    repo.find.mockRejectedValueOnce(new Error('DB'));
    expect(await s.resolveFromCookie('authjs.session-token=valid')).toBeNull();
  });
  it('production accepts only secure cookies; duplicates fail closed', async () => {
    const production = new SessionService(repo, { now: () => 100 }, true);
    expect(await production.resolveFromCookie('authjs.session-token=valid')).toBeNull();
    expect(
      await production.resolveFromCookie('__Secure-authjs.session-token=valid'),
    ).not.toBeNull();
    expect(
      await s.resolveFromCookie('authjs.session-token=valid; authjs.session-token=valid'),
    ).toBeNull();
  });
});
describe('redacted boot environment', () => {
  const env = {
    DATABASE_URL: 'postgresql://example.invalid/db',
    DIRECT_URL: 'postgresql://example.invalid/db',
    AUTH_SECRET: 'x'.repeat(32),
    AUTH_GOOGLE_ID: 'placeholder',
    AUTH_GOOGLE_SECRET: 'placeholder',
    AUTH_GITHUB_ID: 'placeholder',
    AUTH_GITHUB_SECRET: 'placeholder',
    APP_ORIGIN: 'http://localhost:3000',
    NODE_ENV: 'test',
  };
  it('valid config frozen; defaults and optional Nexconn pair work', () => {
    expect(Object.isFrozen(readEnv(env))).toBe(true);
    expect(
      readEnv({ ...env, NEXCONN_APP_KEY: 'placeholder', NEXCONN_APP_SECRET: 'placeholder' })
        .NEXCONN_REGION,
    ).toBe('SG');
  });
  it.each(Object.keys(env))('missing/invalid %s fails without values', (key) => {
    const input: Record<string, string> = { ...env, [key]: key === 'NODE_ENV' ? 'invalid' : '' };
    expect(() => readEnv(input)).toThrow();
    try {
      readEnv(input);
    } catch (e) {
      expect(String(e)).toContain(key);
      expect(String(e)).not.toContain('placeholder');
    }
  });
  it('requires HTTPS and database TLS in production; rejects non-origin and incomplete chat', () => {
    expect(() => readEnv({ ...env, NODE_ENV: 'production' })).toThrow('APP_ORIGIN');
    expect(() => readEnv({ ...env, APP_ORIGIN: 'https://example.invalid/path' })).toThrow(
      'APP_ORIGIN',
    );
    expect(() => readEnv({ ...env, NEXCONN_APP_KEY: 'placeholder' })).toThrow('NEXCONN_APP_KEY');
    expect(() =>
      readEnv({
        ...env,
        APP_ORIGIN: 'https://example.invalid',
        DATABASE_URL: env.DATABASE_URL + '?sslmode=require',
        DIRECT_URL: env.DIRECT_URL + '?sslmode=verify-full',
        NODE_ENV: 'production',
        TRUSTED_PROXY_IPS: '127.0.0.1,::1',
      }),
    ).not.toThrow();
  });
  it('refuses production boot without an explicit trusted proxy', () => {
    const production = {
      ...env,
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://example.invalid',
      DATABASE_URL: env.DATABASE_URL + '?sslmode=require',
      DIRECT_URL: env.DIRECT_URL + '?sslmode=require',
    };
    expect(() => readEnv(production)).toThrow('TRUSTED_PROXY_IPS');
    expect(() => readEnv({ ...production, TRUSTED_PROXY_IPS: 'garbage' })).toThrow(
      'TRUSTED_PROXY_IPS',
    );
    expect(() => readEnv({ ...production, TRUSTED_PROXY_IPS: '127.0.0.1' })).not.toThrow();
  });
});
