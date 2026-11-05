import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import { getPrisma } from '@scalesquad/db';
import { normalizeEmail } from '@scalesquad/shared';
export function createAuthAdapter(
  client = getPrisma(),
  revoked: (token: string) => void = () => {},
): Adapter {
  const adapter = PrismaAdapter(client);
  return {
    ...adapter,
    createUser: (user) =>
      adapter.createUser!({
        ...user,
        email: normalizeEmail(user.email),
        emailVerified: new Date(),
      }),
    getUserByEmail: (email) => adapter.getUserByEmail!(normalizeEmail(email)),
    updateUser: (user) =>
      adapter.updateUser!({
        ...user,
        ...(user.email ? { email: normalizeEmail(user.email) } : {}),
      }),
    // Provider credentials are never needed after identity verification.
    linkAccount: (account) =>
      adapter.linkAccount!({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      }),
    deleteSession: async (token) => {
      const session = await adapter.deleteSession!(token);
      revoked(token);
      return session || null;
    },
  };
}
/** Composition-root injection keeps the View from importing repositories or Prisma. */
export function installAuthAdapter(revoked?: (token: string) => void) {
  const target = globalThis as typeof globalThis & {
    scaleSquadAuthAdapter?: Adapter;
  };
  target.scaleSquadAuthAdapter = createAuthAdapter(getPrisma(), revoked);
}
export async function purgeUnusedProviderTokens() {
  await getPrisma().account.updateMany({
    where: {
      OR: [
        { access_token: { not: null } },
        { refresh_token: { not: null } },
        { id_token: { not: null } },
      ],
    },
    data: { access_token: null, refresh_token: null, id_token: null },
  });
  await getPrisma().user.updateMany({
    where: { emailVerified: null, passwordHash: null, accounts: { some: {} } },
    data: { emailVerified: new Date() },
  });
}
export async function disconnectDatabase() {
  await getPrisma().$disconnect();
}
