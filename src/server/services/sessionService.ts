import type { SessionRepository } from '../domain/models';
import type { Clock } from '../domain/ports';
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
  /** Socket-local cache: no shared token map, and never extends the database expiry. */
  async openSocket(header: string | undefined) {
    const token = this.cookieToken(header);
    if (!token) return null;
    let identity;
    try {
      identity = await this.repo.find(token);
    } catch {
      return null;
    }
    if (!identity || identity.expires <= this.clock.now()) return null;
    const userId = identity.userId;
    let expires = identity.expires;
    let checkedAt = this.clock.now();
    let valid = true;
    let checking: Promise<boolean> | null = null;
    const authorize = async (force = false): Promise<boolean> => {
      const now = this.clock.now();
      if (!valid || expires <= now) return false;
      if (!force && now - checkedAt < 5000) return true;
      if (checking) return checking;
      checking = (async () => {
        try {
          const current = await this.repo.find(token);
          valid = current?.userId === userId && current.expires > this.clock.now();
          if (current && valid) expires = current.expires;
          checkedAt = this.clock.now();
          return valid;
        } catch {
          // A failed lookup says nothing about whether this session was revoked.
          // Preserve its last confirmed expiry and retry on the next check.
          return valid && expires > this.clock.now();
        } finally {
          checking = null;
        }
      })();
      return checking;
    };
    return { token, userId, authorize };
  }
}
