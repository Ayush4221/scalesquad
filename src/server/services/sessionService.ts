import type { SessionRepository } from '../lib/models';
import type { Clock } from '../lib/ports';
export class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly clock: Clock,
    private readonly production = false,
  ) {}
  cookieToken(header: string | undefined): string | null {
    if (!header || header.length > 8192) return null;
    try {
      const entries = header.split(';').map((part) => {
        const i = part.indexOf('=');
        return [part.slice(0, i).trim(), part.slice(i + 1)] as const;
      });
      const names = entries
        .filter(
          ([name]) => name === '__Secure-authjs.session-token' || name === 'authjs.session-token',
        )
        .map(([name]) => name);
      if (new Set(names).size !== names.length) return null;
      const cookies = new Map(entries);
      const raw =
        cookies.get('__Secure-authjs.session-token') ??
        (this.production ? undefined : cookies.get('authjs.session-token'));
      if (!raw) return null;
      const token = decodeURIComponent(raw);
      if (token.length > 512) return null;
      return token;
    } catch {
      return null;
    }
  }
  async resolveToken(token: string) {
    try {
      if (!token || token.length > 512) return null;
      const session = await this.repo.find(token);
      return session && session.expires > this.clock.now()
        ? { userId: session.userId, name: session.name }
        : null;
    } catch {
      return null;
    }
  }
  async resolveFromCookie(header: string | undefined) {
    const token = this.cookieToken(header);
    return token ? this.resolveToken(token) : null;
  }
}
