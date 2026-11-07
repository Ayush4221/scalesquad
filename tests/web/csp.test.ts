import { expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';
import { buildContentSecurityPolicy } from '../../src/utils/contentSecurityPolicy';

it('generates fresh request nonces, overrides attacker input and forwards CSP to SSR', () => {
  const request = new NextRequest('http://localhost:3000/signin', {
    headers: { 'x-nonce': 'attacker', 'content-security-policy': "script-src 'unsafe-inline'" },
  });
  const a = proxy(request),
    b = proxy(request);
  const csp = a.headers.get('content-security-policy')!;
  const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
  expect(nonce).not.toBe('attacker');
  expect(csp).not.toBe(b.headers.get('content-security-policy'));
  expect(a.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
  expect(a.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  expect(csp.split(';').find((part) => part.trim().startsWith('script-src'))).not.toContain(
    'unsafe-inline',
  );
});
it('keeps baseline security headers script-inline-free and preserves deployed chat hosts', () => {
  const policy = buildContentSecurityPolicy({ appOrigin: 'https://example.invalid' });
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain('wss://*.sg-light-api.com');
  for (const region of ['sg', 'us', 'sau']) {
    expect(policy).toContain(`https://*.${region}-light-edge.com`);
    expect(policy).toContain(`wss://*.${region}-light-edge.com`);
  }
  expect(policy).toContain('wss://example.invalid');
  expect(policy).not.toContain('unsafe-eval');
});
