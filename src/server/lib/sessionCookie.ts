export const SESSION_SECONDS = 8 * 60 * 60;
export function sessionCookie(token: string, production: boolean, clear = false): string {
  return `${production ? '__Secure-' : ''}authjs.session-token=${clear ? '' : encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${production ? '; Secure' : ''}`;
}
