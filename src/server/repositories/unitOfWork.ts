import { getPrisma, type Prisma, type PrismaClient } from '@scalesquad/db';
import { AppError } from '@scalesquad/shared';
import { setTimeout as delay } from 'node:timers/promises';

const MAX_TRANSACTION_ATTEMPTS = 5;
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = getPrisma(),
): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++)
    try {
      return await client.$transaction(fn, { isolationLevel: 'Serializable', timeout: 10000 });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034' &&
        attempt < MAX_TRANSACTION_ATTEMPTS - 1
      ) {
        // Retry only aborted database transactions, allowing the competing writer
        // to finish instead of immediately exhausting every attempt in a tight loop.
        await delay(25 * 2 ** attempt);
        continue;
      }
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
