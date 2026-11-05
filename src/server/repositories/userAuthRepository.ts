import { getPrisma } from '@scalesquad/db';
import type { User } from '@prisma/client';
import { normalizeEmail } from '@scalesquad/shared';
import type { UserAuthRepository, AuthUser } from '../lib/authPorts';
import { withTransaction } from './unitOfWork';
export function authUser(user: User): AuthUser | null {
  return user.email
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified?.getTime() ?? null,
        passwordHash: user.passwordHash,
        failedLoginCount: user.failedLoginCount,
        passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
      }
    : null;
}
export class PrismaUserAuthRepository implements UserAuthRepository {
  constructor(private readonly client = getPrisma()) {}
  async byEmail(email: string) {
    const user = await this.client.user.findUnique({ where: { email: normalizeEmail(email) } });
    return user ? authUser(user) : null;
  }
  async byId(id: string) {
    const user = await this.client.user.findUnique({ where: { id } });
    return user ? authUser(user) : null;
  }
  async register(email: string, name: string, hash: string) {
    try {
      return authUser(
        await this.client.user.create({
          data: { email: normalizeEmail(email), name, passwordHash: hash },
        }),
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        return null;
      throw error;
    }
  }
  async failed(id: string, now: number) {
    await this.client.user.updateMany({
      where: { id },
      data: { failedLoginCount: { increment: 1 }, lastFailedLoginAt: new Date(now) },
    });
  }
  async login(
    id: string,
    expectedHash: string,
    nextHash: string | null,
    session: { token: string; expires: number },
    oldToken: string | null,
  ) {
    return withTransaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id, passwordHash: expectedHash },
        data: {
          failedLoginCount: 0,
          lastFailedLoginAt: null,
          ...(nextHash ? { passwordHash: nextHash } : {}),
        },
      });
      if (!updated.count) return false;
      if (oldToken) await tx.session.deleteMany({ where: { sessionToken: oldToken } });
      await tx.session.create({
        data: { sessionToken: session.token, userId: id, expires: new Date(session.expires) },
      });
      return true;
    }, this.client);
  }
  async change(id: string, expectedHash: string, hash: string, currentToken: string, now: number) {
    return withTransaction(async (tx) => {
      if (
        !(await tx.session.findFirst({
          where: { userId: id, sessionToken: currentToken, expires: { gt: new Date(now) } },
        }))
      )
        return false;
      const result = await tx.user.updateMany({
        where: { id, passwordHash: expectedHash },
        data: {
          passwordHash: hash,
          passwordChangedAt: new Date(now),
          failedLoginCount: 0,
          lastFailedLoginAt: null,
        },
      });
      if (!result.count) return false;
      await tx.session.deleteMany({ where: { userId: id, sessionToken: { not: currentToken } } });
      await tx.emailToken.deleteMany({ where: { userId: id, purpose: 'RESET_PASSWORD' } });
      return true;
    }, this.client);
  }
}
