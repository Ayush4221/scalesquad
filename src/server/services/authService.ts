import { randomBytes } from 'node:crypto';
import { AppError, normalizeEmail, requireUser, type RegisterDto } from '@scalesquad/shared';
import type {
  AuthContext,
  AuthEventRepository,
  AuthEventType,
  SessionWriteRepository,
  UserAuthRepository,
} from '../lib/authPorts';
import type { Clock } from '../lib/ports';
import { SESSION_SECONDS } from '../lib/sessionCookie';
import { ipPrefix } from '../lib/clientIp';
import { validatePassword, type PasswordHasher } from './passwordService';

export const REGISTERED = Object.freeze({ message: 'Registration complete. You can sign in now.' });
export const DUMMY_HASH =
  '$scrypt$32768$8$3$KioqKioqKioqKioqKioqKg$kI5_UtO1y6tFYaH7iWTRwAe7efHSdz6Byf3casP3Ky8';
const denied = () => new AppError('UNAUTHENTICATED', 401, 'Could not sign in with those details');
export class AuthService {
  private readonly attempts = new Map<string, { failures: number; at: number }>();
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
    const key = `${email}\0${ctx.ip}`,
      cached = this.attempts.get(key),
      previous = cached && this.clock.now() - cached.at < 900000 ? cached : undefined;
    if (previous) await this.pause(Math.min(2000, previous.failures * 250));
    const user = await this.users.byEmail(email),
      valid = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user?.passwordHash || !valid) {
      if (this.attempts.size >= 10000) this.attempts.clear();
      this.attempts.set(key, {
        failures: Math.min(8, (previous?.failures ?? 0) + 1),
        at: this.clock.now(),
      });
      if (user) await this.users.failed(user.id, this.clock.now());
      await this.event('LOGIN_FAIL', user?.id ?? null, ctx);
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
    this.attempts.delete(key);
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
