import { BaseRepository } from './baseRepository';
import type { SessionRepository, UserRepository } from '../domain/models';
export class PrismaSessionRepository extends BaseRepository implements SessionRepository {
  async find(token: string) {
    const row = await this.client.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });
    return row
      ? { userId: row.userId, name: row.user.name ?? 'Player', expires: row.expires.getTime() }
      : null;
  }
}
export class PrismaUserRepository extends BaseRepository implements UserRepository {
  async find(id: string) {
    const user = await this.client.user.findUnique({
      where: { id },
      select: { id: true, name: true, emailVerified: true },
    });
    return user
      ? { userId: user.id, name: user.name ?? 'Player', emailVerified: user.emailVerified !== null }
      : null;
  }
}
