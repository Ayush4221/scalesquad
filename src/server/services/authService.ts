import { createHash, randomBytes } from 'node:crypto';
import { AppError, normalizeEmail, requireUser, type RegisterDto } from '@scalesquad/shared';
import type {
  AuthContext,
  AuthEventRepository,
  AuthEventType,
  SessionWriteRepository,
  UserAuthRepository,
} from '../domain/authPorts';
import type { Clock } from '../domain/ports';
import { SESSION_SECONDS } from '../../constants/auth';
import { ipPrefix } from '../utils/clientIp';
import { RateLimiter } from '../utils/rateLimit';
import { validatePassword, type PasswordHasher } from './passwordService';

export const REGISTERED = Object.freeze({ message: 'Registration complete. You can sign in now.' });
export const DUMMY_HASH =
  '$scrypt$32768$8$3$KioqKioqKioqKioqKioqKg$kI5_UtO1y6tFYaH7iWTRwAe7efHSdz6Byf3casP3Ky8';
const denied = () => new AppError('UNAUTHENTICATED', 401, 'Could not sign in with those details');
export class AuthService {
  // Fixed hash slots bound memory without clearing unrelated accounts on overflow.
  private readonly failures = new Uint8Array(32768);
  private readonly failedAt = new Float64Array(32768);
  private readonly loginAccounts = new RateLimiter(10, 10 / 900, () => this.clock.now());
  private readonly throttledSources = new RateLimiter(1, 1 / 60, () => this.clock.now());
  private readonly throttledTotal = new RateLimiter(10, 1, () => this.clock.now());
  constructor(
    private readonly users: UserAuthRepository,
    private readonly sessions: SessionWriteRepository,
    private readonly audit: AuthEventRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly revoked: {
      session: (token: string) => void;
      user: (id: string, except?: string) => void;
    },
    private readonly pause: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}
  private async event(type: AuthEventType, userId: string | null, ctx: AuthContext) {
    const prefix = ipPrefix(ctx.ip);
    await this.audit.record(type, userId, prefix, ctx.userAgent.slice(0, 200));
  }
  async throttled(ctx: AuthContext) {
    // Record the signal without letting rejected traffic become a database-write
    // flood. Other auth events keep their normal per-action audit trail.
    try {
      this.throttledSources.take(ipPrefix(ctx.ip));
      this.throttledTotal.take('all');
    } catch {
      return;
    }
    await this.event('THROTTLED', null, ctx);
  }
  async register(input: RegisterDto, ctx: AuthContext) {
    const email = normalizeEmail(input.email),
      password = validatePassword(input.password, email),
      hash = await this.hasher.hash(password);
    const user = await this.users.register(email, input.name, hash);
    await this.event('REGISTER', user?.id ?? null, ctx);
    return REGISTERED;
  }
  async login(email: string, password: string, ctx: AuthContext) {
    email = normalizeEmail(email);
    const key = createHash('sha256').update(email).digest('hex');
    const slot = Number.parseInt(key.slice(0, 8), 16) % this.failures.length;
    const previous = this.clock.now() - this.failedAt[slot]! < 900000 ? this.failures[slot]! : 0;
    if (previous) await this.pause(Math.min(2000, previous * 250));
    const user = await this.users.byEmail(email),
      valid = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user?.passwordHash || !valid) {
      this.failures[slot] = Math.min(8, previous + 1);
      this.failedAt[slot] = this.clock.now();
      await this.event('LOGIN_FAIL', user?.id ?? null, ctx);
      // Account throttling applies only to a verified failure. A correct password
      // must still work after someone else floods this email address.
      this.loginAccounts.take(key);
      throw denied();
    }
    const nextHash = this.hasher.needsRehash(user.passwordHash)
        ? await this.hasher.hash(password)
        : null,
      token = randomBytes(32).toString('base64url');
    if (
      !(await this.users.login(
        user.id,
        user.passwordHash,
        nextHash,
        { token, expires: this.clock.now() + SESSION_SECONDS * 1000 },
        ctx.sessionToken,
      ))
    )
      throw denied();
    if (ctx.sessionToken) this.revoked.session(ctx.sessionToken);
    this.failures[slot] = 0;
    await this.event('LOGIN_OK', user.id, ctx);
    return { token };
  }
  async logout(userId: string | null, ctx: AuthContext) {
    requireUser(userId);
    if (ctx.sessionToken) {
      await this.sessions.remove(ctx.sessionToken);
      this.revoked.session(ctx.sessionToken);
    }
    await this.event('LOGOUT', userId, ctx);
    return { ok: true };
  }
  async logoutEverywhere(userId: string | null, ctx: AuthContext) {
    requireUser(userId);
    await this.sessions.removeAll(userId);
    this.revoked.user(userId);
    await this.event('LOGOUT_ALL', userId, ctx);
    return { ok: true };
  }
  async changePassword(userId: string | null, current: string, next: string, ctx: AuthContext) {
    requireUser(userId);
    const user = await this.users.byId(userId);
    const valid = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, current);
    if (!user?.passwordHash || !valid || !ctx.sessionToken) throw denied();
    const hash = await this.hasher.hash(validatePassword(next, user.email));
    if (
      !(await this.users.change(
        userId,
        user.passwordHash,
        hash,
        ctx.sessionToken,
        this.clock.now(),
      ))
    )
      throw denied();
    this.revoked.user(userId, ctx.sessionToken);
    await this.event('PASSWORD_CHANGE', userId, ctx);
    return { ok: true };
  }
}
