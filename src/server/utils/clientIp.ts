import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

export function normalizeIp(value: string): string | null {
  const ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes('%')) return null;
  return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
}
export function ipPrefix(value: string): string {
  const ip = normalizeIp(value);
  if (!ip) return 'unknown';
  if (isIP(ip) === 4) return `${ip.split('.').slice(0, 3).join('.')}.0/24`;
  const [left = '', right = ''] = ip.split('::'),
    a = left.split(':').filter(Boolean),
    b = right.split(':').filter(Boolean);
  const groups = ip.includes('::')
    ? [...a, ...Array<string>(8 - a.length - b.length).fill('0'), ...b]
    : a;
  return `${groups.slice(0, 3).join(':')}::/48`;
}
/** IPv6 privacy addresses share a /64 quota; IPv4 clients retain individual quotas. */
export function rateLimitIp(value: string): string {
  const ip = normalizeIp(value);
  if (!ip) return value;
  if (isIP(ip) === 4) return ip;
  const [left = '', right = ''] = ip.split('::');
  const a = left.split(':').filter(Boolean),
    b = right.split(':').filter(Boolean);
  const groups = ip.includes('::')
    ? [...a, ...Array<string>(8 - a.length - b.length).fill('0'), ...b]
    : a;
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(':')}::/64`;
}
/** Walk from the trusted socket peer toward the client; never trust a client-supplied prefix. */
export function clientIp(
  req: Pick<IncomingMessage, 'headers' | 'socket'>,
  trusted: readonly string[] = [],
): string {
  const peer = normalizeIp(req.socket.remoteAddress ?? '') ?? 'unknown';
  const proxies = new Set(trusted.map(normalizeIp).filter((ip): ip is string => ip !== null));
  if (!proxies.has(peer)) return peer;
  const header = req.headers['x-forwarded-for'];
  if (typeof header !== 'string' || header.length > 4096) return peer;
  const chain = header.split(',');
  if (chain.length > 32) return peer;
  let current = peer;
  for (let i = chain.length - 1; i >= 0 && proxies.has(current); i--) {
    const next = normalizeIp(chain[i] ?? '');
    if (!next) return peer;
    current = next;
  }
  return current;
}
