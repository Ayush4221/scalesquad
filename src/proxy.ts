import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from './utils/contentSecurityPolicy';

export function proxy(req: NextRequest) {
  // Never trust an incoming nonce. Each rendered response gets fresh entropy.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildContentSecurityPolicy({
    appOrigin: process.env.APP_ORIGIN ?? req.nextUrl.origin,
    nonce,
    development: process.env.NODE_ENV === 'development',
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const path = req.nextUrl.pathname;
  const protectedPage =
    path === '/play' ||
    path.startsWith('/play/') ||
    path === '/match' ||
    path.startsWith('/match/');
  const hasSession =
    req.cookies.has('__Secure-authjs.session-token') || req.cookies.has('authjs.session-token');
  // Cookie presence is a navigation hint. Pages and APIs still verify the session.
  const response =
    protectedPage && !hasSession
      ? NextResponse.redirect(new URL('/signin', req.url))
      : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons/|fonts/|sw.js|manifest.webmanifest|offline.html).*)',
  ],
};
