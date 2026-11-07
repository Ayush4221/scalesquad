import { getPrisma, type Prisma, type PrismaClient } from '@scalesquad/db';
export class BaseRepository {
  constructor(protected readonly client: PrismaClient | Prisma.TransactionClient = getPrisma()) {}
}
