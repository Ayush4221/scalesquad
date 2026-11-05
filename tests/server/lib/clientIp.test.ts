import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { clientIp, normalizeIp, ipPrefix } from '../../../src/server/lib/clientIp';
import { RateLimiter } from '../../../src/server/middleware/rateLimit';

const request = (peer: string, forwarded?: string | string[]) =>
  ({
    socket: { remoteAddress: peer },
    headers: { 'x-forwarded-for': forwarded },
  }) as unknown as IncomingMessage;
describe('trusted proxy address selection', () => {
  it('audit prefixes remove host bits, including compressed IPv6', () => {
    expect(ipPrefix('2001:db8::1234')).toBe('2001:db8:0::/48');
    expect(ipPrefix('::ffff:203.0.113.5')).toBe('203.0.113.0/24');
    expect(ipPrefix('not an ip')).toBe('unknown');
  });
  it('ignores forged headers on direct connections', () => {
    expect(clientIp(request('203.0.113.9', '198.51.100.1'), ['127.0.0.1'])).toBe('203.0.113.9');
  });
  it('walks trusted hops from right to left, stopping before forged prefixes', () => {
    expect(clientIp(request('::ffff:127.0.0.1', '192.0.2.9, 203.0.113.8'), ['127.0.0.1'])).toBe(
      '203.0.113.8',
    );
    expect(clientIp(request('127.0.0.1', '203.0.113.8, 10.0.0.2'), ['127.0.0.1', '10.0.0.2'])).toBe(
      '203.0.113.8',
    );
    expect(normalizeIp('2001:0db8:0:0:0:0:0:1')).toBe('2001:db8::1');
  });
  it.each([
    undefined,
    'garbage',
    ['203.0.113.8'],
    'a'.repeat(4097),
    Array(34).fill('127.0.0.1').join(','),
  ])('malformed forwarding fails closed', (value) => {
    expect(clientIp(request('127.0.0.1', value), ['127.0.0.1'])).toBe('127.0.0.1');
  });
  it('gives different proxied clients separate limit buckets', () => {
    const limit = new RateLimiter(1, 1);
    const key = (ip: string) => clientIp(request('127.0.0.1', ip), ['127.0.0.1']);
    limit.take(key('203.0.113.1'));
    limit.take(key('203.0.113.2'));
    expect(() => limit.take(key('203.0.113.1'))).toThrow();
  });
});
