import { it, expect, vi } from 'vitest';
import { createAuthAdapter } from '../../src/server/repositories/authRepository';
import type { getPrisma } from '@scalesquad/db';

it('OAuth persistence allowlists identity fields and revokes the exact deleted session', async () => {
  const create = vi.fn(async ({ data }: { data: unknown }) => data),
    deleted = vi.fn(async () => null),
    revoked = vi.fn();
  const client = { account: { create }, session: { delete: deleted } } as unknown as ReturnType<
    typeof getPrisma
  >;
  const adapter = createAuthAdapter(client, revoked);
  await adapter.linkAccount!({
    userId: 'a',
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'p',
    access_token: 'unused',
    refresh_token: 'unused',
    id_token: 'unused',
  });
  expect(create).toHaveBeenCalledWith({
    data: { userId: 'a', type: 'oauth', provider: 'google', providerAccountId: 'p' },
  });
  await adapter.deleteSession!('session-a');
  expect(revoked).toHaveBeenCalledWith('session-a');
});
