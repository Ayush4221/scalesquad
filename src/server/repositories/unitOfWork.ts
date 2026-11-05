import { getPrisma, type Prisma, type PrismaClient } from '@scalesquad/db';
import { AppError } from '@scalesquad/shared';
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = getPrisma(),
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      return await client.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10000 });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['P2034', 'P2002'].includes(String(error.code))
      )
        throw new AppError('VERSION_CONFLICT', 409);
      throw error;
    }
  throw new AppError('VERSION_CONFLICT', 409);
}
