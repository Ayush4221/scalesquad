import { getPrisma } from '@scalesquad/db';
import type { AuthEventRepository, AuthEventType } from '../domain/authPorts';
export class PrismaAuthEventRepository implements AuthEventRepository {
  constructor(private readonly client = getPrisma()) {}
  async record(type: AuthEventType, userId: string | null, ipPrefix: string, userAgent: string) {
    await this.client.authEvent.create({
      data: { type, userId, ipPrefix, userAgent: userAgent.slice(0, 200) },
    });
  }
}
