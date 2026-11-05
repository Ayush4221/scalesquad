import { describe, it, expect, vi, afterEach } from 'vitest';
import { readEnv } from '../../../src/server/config/env';
import { assertTestDatabase } from '../../e2e/settings';
afterEach(() => vi.unstubAllEnvs());
const input = {
  DATABASE_URL: 'postgresql://example.invalid/scalesquad_test',
  DIRECT_URL: 'postgresql://example.invalid/scalesquad_test',
  AUTH_SECRET: 'x'.repeat(32),
  APP_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
};
describe('test mode isolation', () => {
  it('allows fake chat and built assets only with test mode and isolated database names', () => {
    expect(
      readEnv({ ...input, NEXCONN_PROVIDER: 'fake', TEST_BUILT_APP: '1' }).TEST_BUILT_APP,
    ).toBe(true);
    for (const flag of [{ NEXCONN_PROVIDER: 'fake' }, { TEST_BUILT_APP: '1' }]) {
      expect(() =>
        readEnv({
          ...input,
          ...flag,
          NODE_ENV: 'production',
          APP_ORIGIN: 'https://example.invalid',
          DATABASE_URL: input.DATABASE_URL + '?sslmode=require',
          DIRECT_URL: input.DIRECT_URL + '?sslmode=require',
        }),
      ).toThrow('TEST_BUILT_APP');
      expect(() => readEnv({ ...input, ...flag, NODE_ENV: 'development' })).toThrow(
        'TEST_BUILT_APP',
      );
      expect(() =>
        readEnv({ ...input, ...flag, DATABASE_URL: 'postgresql://example.invalid/production' }),
      ).toThrow('DATABASE_URL');
    }
  });
  it('direct session seeding refuses production and ordinary database names', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertTestDatabase(input.DATABASE_URL)).toThrow();
    vi.stubEnv('NODE_ENV', 'test');
    expect(() => assertTestDatabase('postgresql://example.invalid/production')).toThrow();
    expect(assertTestDatabase(input.DATABASE_URL)).toBe(input.DATABASE_URL);
  });
});
