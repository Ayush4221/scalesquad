import { randomUUID } from 'node:crypto';
import { AppError } from '@scalesquad/shared';
import { buildContentSecurityPolicy } from '../../utils/contentSecurityPolicy';
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
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy({
      appOrigin,
      development: development && !production,
    }),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (production) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}
