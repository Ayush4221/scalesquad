import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '../../../src/server/utils/rateLimit';
import { AuthLimits } from '../../../src/server/middleware/authLimits';
import { authFixture } from '../authFakes';
import { fixture } from '../fakes';
import { runtimePolicy } from '../../../src/server/constants/runtimePolicy';

afterEach(() => vi.unstubAllEnvs());

describe('local development rate-limit policy', () => {
  it('bypasses the daily creation quota in development while requiring authentication', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const f = fixture();
    vi.spyOn(f.repo, 'countHosted').mockResolvedValue({
      active: 0,
      recent: runtimePolicy.maxMatchesPerDay,
    });
    await expect(f.match.createMatch(null)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(f.match.createMatch('a')).resolves.toBeDefined();
  });

  it.each(['production', 'test'])('keeps the daily creation quota in %s', async (env) => {
    vi.stubEnv('NODE_ENV', env);
    const f = fixture();
    vi.spyOn(f.repo, 'countHosted').mockResolvedValue({
      active: 0,
      recent: runtimePolicy.maxMatchesPerDay,
    });
    await expect(f.match.createMatch('a')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(f.chat.groups.size).toBe(0);
  });

  it('keeps concurrent match capacity bounded in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const f = fixture();
    vi.spyOn(f.repo, 'countHosted').mockResolvedValue({
      active: runtimePolicy.maxActiveMatchesPerHost,
      recent: 0,
    });
    await expect(f.match.createMatch('a')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(f.chat.groups.size).toBe(0);
  });

  it('does not consume quota buckets in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const limiter = new RateLimiter(1, 1);
    const auth = new AuthLimits();
    for (let i = 0; i < 100; i++) {
      limiter.take('127.0.0.1');
      auth.take('authLogin', '127.0.0.1', null, { email: 'ada@example.invalid' });
      auth.take('authRegister', '127.0.0.1', null, { email: 'ada@example.invalid' });
      auth.take('authChange', '127.0.0.1', 'ada', {});
    }
    expect(limiter.size).toBe(0);
  });

  it.each(['production', 'test', '', 'Development', undefined])(
    'keeps quotas enabled when NODE_ENV is %s',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      const limiter = new RateLimiter(1, 1);
      limiter.take('127.0.0.1');
      expect(() => limiter.take('127.0.0.1')).toThrow();
    },
  );

  it('still verifies passwords and records failures without development backoff', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const f = authFixture();
    const user = await f.registered();
    for (let i = 0; i < 12; i++)
      await expect(f.auth.login(user.email, 'incorrect password', f.ctx)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    expect(f.pause).not.toHaveBeenCalled();
    expect(f.hasher.verify).toHaveBeenCalledTimes(12);
    expect(f.audit.record.mock.calls.filter(([type]) => type === 'LOGIN_FAIL')).toHaveLength(12);
    expect((await f.auth.login(user.email, f.password, f.ctx)).token).toBeTruthy();
  });

  it.each(['production', 'test'])(
    'keeps password backoff and account quotas in %s',
    async (env) => {
      vi.stubEnv('NODE_ENV', env);
      const f = authFixture();
      const user = await f.registered();
      for (let i = 0; i < 10; i++)
        await expect(f.auth.login(user.email, 'incorrect password', f.ctx)).rejects.toMatchObject({
          code: 'UNAUTHENTICATED',
        });
      await expect(f.auth.login(user.email, 'incorrect password', f.ctx)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
      expect(f.pause).toHaveBeenCalledWith(2000);
    },
  );
});
