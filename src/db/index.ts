import { PrismaClient } from '@prisma/client';
const state = globalThis as typeof globalThis & { scaleSquadPrisma?: PrismaClient };
export function getPrisma(): PrismaClient {
  state.scaleSquadPrisma ??= new PrismaClient();
  return state.scaleSquadPrisma;
}
export { Prisma, PrismaClient, Role, MatchPhase } from '@prisma/client';
