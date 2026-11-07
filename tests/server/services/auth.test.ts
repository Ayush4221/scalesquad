import { describe, it, expect, vi } from 'vitest';
import { authFixture } from '../authFakes';
import { AuthService, REGISTERED, DUMMY_HASH } from '../../../src/server/services/authService';
import { fixture } from '../fakes';
import { authControllers } from '../../../src/server/controllers/authController';

describe('password accounts without email delivery', () => {
  it('keeps account throttling across source addresses and does equal failure-write work', async () => {
    const f = authFixture();
    const user = await f.registered();
    const failedWrite = vi.spyOn(f.userRepo, 'login');
    for (let i = 0; i < 10; i++)
      await expect(
        f.auth.login(user.email, 'wrong value', { ...f.ctx, ip: `203.0.113.${i}` }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      f.auth.login(user.email, 'wrong value', { ...f.ctx, ip: '198.51.100.1' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(f.pause).toHaveBeenCalledWith(2000);
    expect(failedWrite).not.toHaveBeenCalled();
    // Attacker failures from many addresses cannot consume the owner's login.
    expect((await f.auth.login(user.email, f.password, f.ctx)).token).toBeTruthy();
    const knownEvents = f.audit.record.mock.calls.filter(([type]) => type === 'LOGIN_FAIL').length;
    await expect(
      f.auth.login('unknown@example.invalid', 'wrong value', f.ctx),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(f.audit.record.mock.calls.filter(([type]) => type === 'LOGIN_FAIL')).toHaveLength(
      knownEvents + 1,
    );
  });
  it('keeps existing password login working after new-password requirements change', async () => {
    const f = authFixture();
    const user = await f.registered();
    user.passwordHash = 'hash:old lowercase passphrase';
    expect((await f.auth.login(user.email, 'old lowercase passphrase', f.ctx)).token).toBeTruthy();
  });
  it('the default runtime delays repeated bad-password attempts', async () => {
    vi.useFakeTimers();
    try {
      const f = authFixture();
      const user = await f.registered();
      const auth = new AuthService(
        f.userRepo,
        f.sessionRepo,
        f.audit,
        f.hasher,
        f.clock,
        f.revoked,
      );
      await expect(auth.login(user.email, 'incorrect password', f.ctx)).rejects.toThrow();
      let completed = false;
      const attempt = auth.login(user.email, 'incorrect password', f.ctx).catch(() => {
        completed = true;
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(completed).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      await attempt;
      expect(completed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('normalizes registration, keeps email ownership unclaimed and hides duplicates', async () => {
    const f = authFixture();
    const input = { email: '  ADA@example.invalid ', name: 'Ada', password: f.password };
    expect(await f.auth.register(input, f.ctx)).toEqual(REGISTERED);
    const user = [...f.users.values()][0]!;
    expect(user.email).toBe('ada@example.invalid');
    expect(user.emailVerified).toBeNull();
    expect(user.passwordHash).not.toBe(f.password);
    expect(
      await f.auth.register({ ...input, password: 'Different!42 long password' }, f.ctx),
    ).toEqual(REGISTERED);
    expect(f.users.size).toBe(1);
    expect(user.passwordHash).toBe(`hash:${f.password}`);
    expect((await f.auth.login(user.email, f.password, f.ctx)).token).toMatch(/^[\w-]{43}$/);
  });
  it('unknown, wrong-password and OAuth-only accounts share a generic failure', async () => {
    const f = authFixture();
    const user = await f.registered();
    for (const [email, password] of [
      ['unknown@example.invalid', f.password],
      [user.email, 'incorrect value here'],
    ])
      await expect(f.auth.login(email!, password!, f.ctx)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
        safeMessage: 'Could not sign in with those details',
      });
    expect(f.hasher.verify).toHaveBeenCalledWith(DUMMY_HASH, f.password);
    user.passwordHash = null;
    await expect(f.auth.login(user.email, f.password, f.ctx)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(f.pause).toHaveBeenCalledWith(250);
  });
  it('rotates sessions, resets counters and upgrades supported old hashes', async () => {
    const f = authFixture();
    const user = await f.registered();
    f.sessions.set('old', { userId: user.id, expires: 9999 });
    await expect(f.auth.login(user.email, 'wrong value here', f.ctx)).rejects.toThrow();
    f.hasher.needsRehash.mockReturnValue(true);
    const { token } = await f.auth.login(user.email, f.password, { ...f.ctx, sessionToken: 'old' });
    expect(f.sessions.has('old')).toBe(false);
    expect(f.sessions.get(token)?.userId).toBe(user.id);
    expect(user.failedLoginCount).toBe(0);
    expect(f.revoked.session).toHaveBeenCalledWith('old');
    expect(f.hasher.hash).toHaveBeenCalledTimes(2);
    expect(f.pause).toHaveBeenCalledWith(250);
  });
  it('fails closed when concurrent login or password-change preconditions change', async () => {
    const f = authFixture();
    const user = await f.registered();
    vi.spyOn(f.userRepo, 'login').mockResolvedValue(false);
    await expect(f.auth.login(user.email, f.password, f.ctx)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    vi.spyOn(f.userRepo, 'change').mockResolvedValue(false);
    await expect(
      f.auth.changePassword(user.id, f.password, 'Silent!42 forests dancing slowly', {
        ...f.ctx,
        sessionToken: 'lost',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('requires the current password and session; change revokes only other sessions', async () => {
    const f = authFixture();
    const user = await f.registered();
    f.sessions.set('current', { userId: user.id, expires: 99999 });
    f.sessions.set('other', { userId: user.id, expires: 99999 });
    await expect(
      f.auth.changePassword(user.id, 'wrong password', f.password, {
        ...f.ctx,
        sessionToken: 'current',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      f.auth.changePassword(user.id, f.password, 'Silent!42 forests dancing slowly', f.ctx),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await f.auth.changePassword(user.id, f.password, 'Silent!42 forests dancing slowly', {
      ...f.ctx,
      sessionToken: 'current',
    });
    expect([...f.sessions.keys()]).toEqual(['current']);
    expect(f.revoked.user).toHaveBeenCalledWith(user.id, 'current');
    await expect(f.auth.login(user.email, f.password, f.ctx)).rejects.toThrow();
    expect(
      (await f.auth.login(user.email, 'Silent!42 forests dancing slowly', f.ctx)).token,
    ).toBeTruthy();
  });
  it('logout scopes revocation and rejects anonymous operations', async () => {
    const f = authFixture();
    const user = await f.registered();
    f.sessions.set('current', { userId: user.id, expires: 99999 });
    f.sessions.set('other', { userId: user.id, expires: 99999 });
    await f.auth.logout(user.id, { ...f.ctx, sessionToken: 'current' });
    expect([...f.sessions.keys()]).toEqual(['other']);
    await f.auth.logoutEverywhere(user.id, f.ctx);
    expect(f.sessions.size).toBe(0);
    expect(f.revoked.user).toHaveBeenCalledWith(user.id);
    await f.auth.logout(user.id, f.ctx);
    for (const action of [
      () => f.auth.logout(null, f.ctx),
      () => f.auth.logoutEverywhere(null, f.ctx),
      () => f.auth.changePassword(null, f.password, f.password, f.ctx),
    ])
      await expect(action()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('audit records truncate metadata and never contain email/password', async () => {
    const f = authFixture();
    await f.auth.register(
      { email: 'ada@example.invalid', name: 'Ada', password: f.password },
      { ...f.ctx, ip: '2001:db8:abcd:1234::1', userAgent: 'x'.repeat(300) },
    );
    expect(f.audit.record).toHaveBeenCalledWith(
      'REGISTER',
      expect.any(String),
      '2001:db8:abcd::/48',
      'x'.repeat(200),
    );
    const controller = authControllers(f.auth);
    await controller.authThrottled({ userId: null, name: null, matchId: '', body: {} });
    expect(f.audit.record).toHaveBeenCalledWith('THROTTLED', null, 'unknown', '');
    const audit = JSON.stringify(f.audit.record.mock.calls);
    expect(audit).not.toContain('ada@example.invalid');
    expect(audit).not.toContain(f.password);
  });
  it('bounds throttle audit writes per source and globally, then resumes after refill', async () => {
    const f = authFixture();
    await Promise.all(Array.from({ length: 100 }, () => f.auth.throttled(f.ctx)));
    expect(f.audit.record).toHaveBeenCalledTimes(1);
    f.clock.value += 60000;
    await f.auth.throttled(f.ctx);
    expect(f.audit.record).toHaveBeenCalledTimes(2);

    const rotating = authFixture();
    await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        rotating.auth.throttled({
          ...rotating.ctx,
          ip: `198.18.${i}.1`,
        }),
      ),
    );
    expect(rotating.audit.record).toHaveBeenCalledTimes(10);
    rotating.clock.value += 1000;
    await rotating.auth.throttled({ ...rotating.ctx, ip: '198.19.0.1' });
    expect(rotating.audit.record).toHaveBeenCalledTimes(11);
  });
  it('signed-in users can create and join without claiming verified email ownership', async () => {
    const f = fixture();
    vi.spyOn(f.users, 'find').mockImplementation(async (id) => ({
      userId: id,
      name: id,
      emailVerified: false,
    }));
    const match = await f.match.createMatch('a');
    expect((await f.match.joinMatch('b', match.joinCode!)).members).toHaveLength(2);
  });
});
