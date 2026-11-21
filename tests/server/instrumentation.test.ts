import { afterEach, expect, it, vi } from 'vitest';
import type { Adapter } from 'next-auth/adapters';
import { register } from '../../src/instrumentation';
import { installAuthAdapter } from '../../src/server/repositories/authRepository';

const { client } = vi.hoisted(() => ({
  client: { session: { delete: vi.fn(async () => null) } },
}));

vi.mock('@scalesquad/db', () => ({ getPrisma: () => client }));

const authRuntime = globalThis as typeof globalThis & {
  scaleSquadAuthAdapter?: Adapter;
  scaleSquadOAuthRecovery?: unknown;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('initializes OAuth dependencies when Next starts without the custom server', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubGlobal('scaleSquadAuthAdapter', undefined);
  vi.stubGlobal('scaleSquadOAuthRecovery', undefined);

  await register();

  expect(authRuntime.scaleSquadAuthAdapter?.getSessionAndUser).toBeTypeOf('function');
  expect(authRuntime.scaleSquadOAuthRecovery).toBeTypeOf('function');
  const adapter = authRuntime.scaleSquadAuthAdapter;
  const recovery = authRuntime.scaleSquadOAuthRecovery;
  await register();
  expect(authRuntime.scaleSquadAuthAdapter).toBe(adapter);
  expect(authRuntime.scaleSquadOAuthRecovery).toBe(recovery);
});

it('preserves the custom server adapter and its exact-session revocation hook', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubGlobal('scaleSquadAuthAdapter', undefined);
  vi.stubGlobal('scaleSquadOAuthRecovery', undefined);
  const revoked = vi.fn();
  installAuthAdapter(revoked);
  const adapter = authRuntime.scaleSquadAuthAdapter!;
  const recovery = authRuntime.scaleSquadOAuthRecovery;

  await register();
  await adapter.deleteSession!('expired-session');

  expect(authRuntime.scaleSquadAuthAdapter).toBe(adapter);
  expect(authRuntime.scaleSquadOAuthRecovery).toBe(recovery);
  expect(revoked).toHaveBeenCalledExactlyOnceWith('expired-session');
});

it.each(['edge', undefined])('does not initialize database auth in runtime %s', async (runtime) => {
  vi.stubEnv('NEXT_RUNTIME', runtime);
  vi.stubGlobal('scaleSquadAuthAdapter', undefined);
  vi.stubGlobal('scaleSquadOAuthRecovery', undefined);

  await register();

  expect(authRuntime.scaleSquadAuthAdapter).toBeUndefined();
  expect(authRuntime.scaleSquadOAuthRecovery).toBeUndefined();
});
