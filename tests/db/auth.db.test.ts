import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getPrisma } from '../../src/db';
import { PrismaUserAuthRepository } from '../../src/server/repositories/userAuthRepository';
import { PrismaSessionWriteRepository } from '../../src/server/repositories/sessionWriteRepository';
import { PrismaAuthEventRepository } from '../../src/server/repositories/authEventRepository';
import { PrismaSessionRepository } from '../../src/server/repositories/sessionRepository';
import {
  createAuthAdapter,
  recoverVerifiedOAuthIdentity,
} from '../../src/server/repositories/authRepository';
import { PrismaPushRepository } from '../../src/server/repositories/pushRepository';
import { AuthService } from '../../src/server/services/authService';
import { SessionService } from '../../src/server/services/sessionService';
import { ScryptPasswordHasher } from '../../src/server/services/passwordService';

describe('Postgres password sessions and push ownership', () => {
  const db = getPrisma();
  const prefix = `authdb${Date.now()}`;
  const email = `${prefix}@example.invalid`;
  const userIds: string[] = [];
  const clock = { now: () => Date.now() };
  const users = new PrismaUserAuthRepository(db);
  const revoked = { session: vi.fn(), user: vi.fn() };
  const service = new AuthService(
    users,
    new PrismaSessionWriteRepository(db),
    new PrismaAuthEventRepository(db),
    {
      hash: async (password) => `test-hash:${password}`,
      verify: async (hash, password) => hash === `test-hash:${password}`,
      needsRehash: () => false,
    },
    clock,
    revoked,
    async () => {},
  );
  const ctx = { ip: '203.0.113.1', userAgent: 'test', sessionToken: null };
  const password = 'Silent!42 forests dancing slowly';
  beforeAll(() => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
      throw new Error('Use isolated *_test database');
  });
  afterAll(async () => {
    await db.authEvent.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  it('normalizes email uniqueness and shares immediate password login with Auth.js', async () => {
    await service.register({ email: `  ${email.toUpperCase()}  `, name: 'Test', password }, ctx);
    const user = (await users.byEmail(email))!;
    userIds.push(user.id);
    expect(user.emailVerified).toBeNull();
    expect(await users.register(email.toUpperCase(), 'Duplicate', 'unused-test-hash')).toBeNull();
    const fullWidth = [...email]
      .map((char) =>
        char.charCodeAt(0) >= 33 && char.charCodeAt(0) <= 126
          ? String.fromCharCode(char.charCodeAt(0) + 0xfee0)
          : char,
      )
      .join('');
    expect(await users.register(fullWidth, 'Duplicate', 'unused-test-hash')).toBeNull();
    const login = await service.login(email, password, ctx);
    const adapter = createAuthAdapter(db);
    expect((await adapter.getSessionAndUser!(login.token))?.user.id).toBe(user.id);
    const reader = new SessionService(new PrismaSessionRepository(db), clock, true);
    expect(
      (await reader.resolveFromCookie(`__Secure-authjs.session-token=${login.token}`))?.userId,
    ).toBe(user.id);
    expect(await reader.resolveFromCookie(`authjs.session-token=${login.token}`)).toBeNull();
    await service.logoutEverywhere(user.id, ctx);
    expect(await adapter.getSessionAndUser!(login.token)).toBeNull();
    expect(revoked.user).toHaveBeenCalledWith(user.id);
  });
  it('uses real scrypt for signup, login and password change without mail', async () => {
    const real = new AuthService(
      users,
      new PrismaSessionWriteRepository(db),
      new PrismaAuthEventRepository(db),
      new ScryptPasswordHasher(),
      clock,
      revoked,
      async () => {},
    );
    const address = `scrypt-${email}`;
    await real.register({ email: address, name: 'Password test', password }, ctx);
    const user = (await users.byEmail(address))!;
    userIds.push(user.id);
    expect(user.passwordHash).toMatch(/^\$scrypt\$/);
    expect(user.emailVerified).toBeNull();
    const current = await real.login(address, password, ctx);
    const other = await real.login(address, password, ctx);
    await real.changePassword(user.id, password, 'River!12 lantern marble cloud', {
      ...ctx,
      sessionToken: current.token,
    });
    const adapter = createAuthAdapter(db);
    expect((await adapter.getSessionAndUser!(current.token))?.user.id).toBe(user.id);
    expect(await adapter.getSessionAndUser!(other.token)).toBeNull();
    await expect(real.login(address, password, ctx)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect((await real.login(address, 'River!12 lantern marble cloud', ctx)).token).toBeTruthy();
    expect(await db.emailToken.count({ where: { userId: user.id } })).toBe(0);
  }, 15000);
  it('OAuth email lookup preserves password accounts and their existing sessions', async () => {
    const user = (await users.byEmail(email))!;
    const login = await service.login(email, password, ctx);
    const adapter = createAuthAdapter(db);
    expect((await adapter.getUserByEmail!(email.toUpperCase()))?.id).toBe(user.id);
    expect((await users.byId(user.id))?.passwordHash).toBe(user.passwordHash);
    expect((await users.byId(user.id))?.emailVerified).toBeNull();
    expect((await adapter.getSessionAndUser!(login.token))?.user.id).toBe(user.id);
    expect(await db.account.count({ where: { userId: user.id } })).toBe(0);
  });
  it('verified OAuth quarantines an unverified password identity and creates a fresh owner', async () => {
    const address = `reclaim-${email}`;
    const old = (await users.register(address, 'Squatter', 'squatter-password'))!;
    userIds.push(old.id);
    const token = `${prefix}-reclaim-session`;
    await db.session.create({
      data: { userId: old.id, sessionToken: token, expires: new Date(Date.now() + 60000) },
    });
    await db.emailToken.create({
      data: {
        userId: old.id,
        purpose: 'RESET_PASSWORD',
        tokenHash: `${prefix}-reset`,
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const revoke = vi.fn();
    const identity = {
      provider: 'google' as const,
      providerAccountId: `${prefix}-google-owner`,
      type: 'oidc' as const,
      email: address.toUpperCase(),
      name: 'Verified owner',
      image: null,
    };
    await recoverVerifiedOAuthIdentity(identity, db, revoke);
    const owner = (await users.byEmail(address))!;
    userIds.push(owner.id);
    expect(owner.id).not.toBe(old.id);
    expect(owner.name).toBe('Verified owner');
    expect(owner.emailVerified).not.toBeNull();
    expect(owner.passwordHash).toBeNull();
    const previous = await db.user.findUniqueOrThrow({ where: { id: old.id } });
    expect(previous.email).toBeNull();
    expect(previous.passwordHash).toBeNull();
    expect(await db.session.count({ where: { userId: old.id } })).toBe(0);
    expect(await db.emailToken.count({ where: { userId: old.id } })).toBe(0);
    expect(revoke).toHaveBeenCalledWith(token);
    expect(
      (
        await createAuthAdapter(db).getUserByAccount!({
          provider: 'google',
          providerAccountId: identity.providerAccountId,
        })
      )?.id,
    ).toBe(owner.id);
    await recoverVerifiedOAuthIdentity(identity, db, revoke);
    expect((await users.byEmail(address))?.id).toBe(owner.id);
  });
  it('OAuth recovery preserves verified password accounts and never auto-links them', async () => {
    const address = `verified-${email}`;
    const old = await db.user.create({
      data: {
        email: address,
        emailVerified: new Date(),
        passwordHash: 'verified-password',
        name: 'Original',
      },
    });
    userIds.push(old.id);
    await recoverVerifiedOAuthIdentity(
      {
        provider: 'github',
        providerAccountId: `${prefix}-not-linked`,
        type: 'oauth',
        email: address,
        name: 'Other',
        image: null,
      },
      db,
    );
    expect((await users.byEmail(address))?.passwordHash).toBe('verified-password');
    expect(await db.account.count({ where: { userId: old.id } })).toBe(0);
  });
  it('keeps subscriptions owner-bound, idempotent and capped at five devices', async () => {
    const user = (await users.byEmail(email))!;
    const repo = new PrismaPushRepository(db);
    const value = (id: number) => ({
      endpoint: `https://fcm.googleapis.com/${prefix}/${id}`,
      keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
    });
    for (let index = 0; index < 7; index++) await repo.save(user.id, value(index), 'test');
    expect(await repo.list(user.id)).toHaveLength(5);
    await repo.save(user.id, value(6), 'test');
    expect(await repo.list(user.id)).toHaveLength(5);
    await repo.remove('outsider', value(6).endpoint);
    expect(
      (await repo.list(user.id)).some(
        (subscription) => subscription.endpoint === value(6).endpoint,
      ),
    ).toBe(true);
    await expect(repo.save('outsider', value(6), 'test')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
