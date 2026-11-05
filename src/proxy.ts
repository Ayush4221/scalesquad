import { NextResponse, type NextRequest } from 'next/server';
export function proxy(req: NextRequest) {
  // Presence is only a navigation hint; server pages and APIs verify the exact
  // runtime cookie name and database session, including Secure-only production.
  if (!req.cookies.has('__Secure-authjs.session-token') && !req.cookies.has('authjs.session-token'))
    return NextResponse.redirect(new URL('/signin', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/play/:path*', '/match/:path*'] };
