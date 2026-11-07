import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import { getPrisma } from '@scalesquad/db';
import { normalizeEmail, type VerifiedOAuthIdentity } from '@scalesquad/shared';
import { withTransaction } from './unitOfWork';

/** Reserve a fresh verified identity without inheriting the squatter's game data. */
export async function recoverVerifiedOAuthIdentity(
  identity: VerifiedOAuthIdentity,
  client = getPrisma(),
  revoked: (token: string) => void = () => {},
) {
  const tokens = await withTransaction(async (tx) => {
    const linked = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
        },
      },
    });
    if (linked) return [];
    const old = await tx.user.findFirst({
      where: {
        email: normalizeEmail(identity.email),
        emailVerified: null,
        passwordHash: { not: null },
        accounts: { none: {} },
      },
      select: { id: true },
    });
    if (!old) return [];
    const sessions = await tx.session.findMany({
      where: { userId: old.id },
      select: { sessionToken: true },
    });
    // The old record may own matches and private evidence. Quarantine its identity
    // instead of transferring any attacker-controlled state to the mailbox owner.
    await tx.user.update({
      where: { id: old.id },
      data: {
        email: null,
        passwordHash: null,
        name: null,
        image: null,
        passwordChangedAt: new Date(),
      },
    });
    await tx.session.deleteMany({ where: { userId: old.id } });
    await tx.emailToken.deleteMany({ where: { userId: old.id } });
    await tx.pushSubscription.deleteMany({ where: { userId: old.id } });
    const user = await tx.user.create({
      data: {
        email: normalizeEmail(identity.email),
        emailVerified: new Date(),
        name: identity.name,
        image: identity.image,
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        type: identity.type,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
      },
    });
    return sessions.map((session) => session.sessionToken);
  }, client);
  for (const token of tokens) revoked(token);
}
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
    scaleSquadOAuthRecovery?: (identity: VerifiedOAuthIdentity) => Promise<void>;
  };
  target.scaleSquadAuthAdapter = createAuthAdapter(getPrisma(), revoked);
  target.scaleSquadOAuthRecovery = (identity) =>
    recoverVerifiedOAuthIdentity(identity, getPrisma(), revoked);
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
