import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthLimits } from '../../../src/server/middleware/authLimits';
afterEach(() => vi.useRealTimers());
describe('explicit auth quotas', () => {
  it('leaves account-wide failure limits to password verification instead of blocking new sources', () => {
    const limits = new AuthLimits();
    for (let i = 0; i < 10; i++)
      limits.take('authLogin', `203.0.113.${i}`, null, { email: 'ada@example.invalid' });
    expect(() =>
      limits.take('authLogin', '198.51.100.1', null, { email: 'ADA@example.invalid' }),
    ).not.toThrow();
  });
  it.each([
    ['authRegister', 3, 'email'],
    ['authLogin', 5, 'pair'],
    ['authChange', 5, 'user'],
  ])('%s enforces its configured burst', (route, capacity) => {
    const limits = new AuthLimits();
    for (let i = 0; i < Number(capacity); i++)
      limits.take(String(route), '203.0.113.1', 'user', { email: 'ada@example.invalid' });
    expect(() =>
      limits.take(String(route), '203.0.113.1', 'user', { email: ' ADA@example.invalid ' }),
    ).toThrow();
  });
  it('IP ceilings apply across email addresses; invalid inputs and generic routes stay bounded', () => {
    const limits = new AuthLimits();
    for (let i = 0; i < 10; i++)
      limits.take('authLogin', '203.0.113.1', null, { email: `u${i}@example.invalid` });
    expect(() =>
      limits.take('authLogin', '203.0.113.1', null, { email: 'different@example.invalid' }),
    ).toThrow();
    limits.take('authLogin', '203.0.113.2', null, { email: 'different@example.invalid' });
    limits.take('authChange', '203.0.113.2', null, null);
    limits.take('authChange', '203.0.113.3', null, {});
    limits.take('unrelated', '203.0.113.2', null, {});
  });
});
