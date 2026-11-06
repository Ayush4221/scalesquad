import { vi } from 'vitest';
import type {
  AuthUser,
  UserAuthRepository,
  SessionWriteRepository,
  AuthContext,
  AuthEventRepository,
} from '../../src/server/lib/authPorts';
import { AuthService } from '../../src/server/services/authService';
import { normalizeEmail } from '@scalesquad/shared';

export function authFixture() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { userId: string; expires: number }>();
  let sequence = 0;
  const clock = {
    value: 1000,
    now() {
      return this.value;
    },
  };
  const userRepo: UserAuthRepository = {
    async byEmail(email) {
      return [...users.values()].find((user) => user.email === normalizeEmail(email)) ?? null;
    },
    async byId(id) {
      return users.get(id) ?? null;
    },
    async register(email, name, passwordHash) {
      if (await this.byEmail(email)) return null;
      const user: AuthUser = {
        id: `user${++sequence}`,
        email: normalizeEmail(email),
        name,
        passwordHash,
        emailVerified: null,
        passwordChangedAt: null,
        failedLoginCount: 0,
      };
      users.set(user.id, user);
      return user;
    },
    async failed(id) {
      users.get(id)!.failedLoginCount++;
    },
    async login(id, expectedHash, nextHash, session, oldToken) {
      const user = users.get(id);
      if (!user || user.passwordHash !== expectedHash) return false;
      if (nextHash) user.passwordHash = nextHash;
      user.failedLoginCount = 0;
      if (oldToken) sessions.delete(oldToken);
      sessions.set(session.token, { userId: id, expires: session.expires });
      return true;
    },
    async change(id, expectedHash, hash, currentToken, now) {
      const user = users.get(id);
      if (!user || user.passwordHash !== expectedHash || sessions.get(currentToken)?.userId !== id)
        return false;
      user.passwordHash = hash;
      user.passwordChangedAt = now;
      for (const [key, session] of sessions)
        if (session.userId === id && key !== currentToken) sessions.delete(key);
      return true;
    },
  };
  const sessionRepo: SessionWriteRepository = {
    async remove(token) {
      sessions.delete(token);
    },
    async removeAll(id) {
      for (const [key, session] of sessions) if (session.userId === id) sessions.delete(key);
    },
  };
  const hasher = {
    hash: vi.fn(async (password: string) => `hash:${password.normalize('NFKC')}`),
    verify: vi.fn(
      async (hash: string, password: string) => hash === `hash:${password.normalize('NFKC')}`,
    ),
    needsRehash: vi.fn(() => false),
  };
  const audit = { record: vi.fn<AuthEventRepository['record']>(async () => {}) };
  const revoked = { session: vi.fn(), user: vi.fn() };
  const pause = vi.fn(async () => {});
  const auth = new AuthService(userRepo, sessionRepo, audit, hasher, clock, revoked, pause);
  const ctx: AuthContext = { ip: '203.0.113.44', userAgent: 'test', sessionToken: null };
  const password = 'River!12';
  async function registered() {
    await auth.register({ email: 'ada@example.invalid', name: 'Ada', password }, ctx);
    return [...users.values()][0]!;
  }
  return {
    auth,
    users,
    sessions,
    userRepo,
    sessionRepo,
    hasher,
    audit,
    revoked,
    clock,
    ctx,
    pause,
    password,
    registered,
  };
}
