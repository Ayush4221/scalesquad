import { getPrisma } from '@scalesquad/db';
import type { SessionWriteRepository } from '../lib/authPorts';
export class PrismaSessionWriteRepository implements SessionWriteRepository {
  constructor(private readonly client = getPrisma()) {}
  async remove(token: string) {
    await this.client.session.deleteMany({ where: { sessionToken: token } });
  }
  async removeAll(userId: string) {
    await this.client.session.deleteMany({ where: { userId } });
  }
}
