import { randomUUID } from 'node:crypto';
import { AppError } from '@scalesquad/shared';
export const requestId = () => randomUUID();
export function originCheck(
  method: string,
  origin: string | undefined,
  fetchSite: string | undefined,
  expected: string,
) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  if (origin === expected || (origin === undefined && fetchSite === 'same-origin')) return;
  throw new AppError('FORBIDDEN', 403, 'Origin not allowed');
}
export function securityHeaders(production: boolean, appOrigin: string, development = false) {
  const ws = appOrigin.replace(/^http/, 'ws');
  // React's development runtime needs eval for debugging; built pages do not.
  const devScripts = development && !production ? " 'unsafe-eval'" : '';
  const chatHosts = ['sg-light-api.com', 'us-light-api.com', 'sau-light-api.com']
    .flatMap((host) => [`https://*.${host}`, `wss://*.${host}`])
    .join(' ');
  const headers: Record<string, string> = {
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'${devScripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com; font-src 'self' data:; connect-src 'self' ${ws} https://*.nexconn.ai wss://*.nexconn.ai ${chatHosts}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  headers['Content-Security-Policy'] += "; worker-src 'self'; manifest-src 'self'";
  if (production) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}
