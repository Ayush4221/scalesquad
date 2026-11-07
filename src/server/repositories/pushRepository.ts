import { getPrisma } from '@scalesquad/db';
import { AppError, type PushSubscriptionDto } from '@scalesquad/shared';
import type { PushRepository } from '../infra/push';
import { withTransaction } from './unitOfWork';
export class PrismaPushRepository implements PushRepository {
  constructor(private readonly client = getPrisma()) {}
  async save(userId: string, value: PushSubscriptionDto, userAgent: string) {
    await withTransaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint: value.endpoint },
      });
      if (existing && existing.userId !== userId) throw new AppError('FORBIDDEN', 403);
      const data = {
        p256dh: value.keys.p256dh,
        auth: value.keys.auth,
        userAgent,
        lastUsedAt: new Date(),
      };
      await tx.pushSubscription.upsert({
        where: { endpoint: value.endpoint },
        create: { endpoint: value.endpoint, userId, ...data },
        update: data,
      });
      const extra = await tx.pushSubscription.findMany({
        where: { userId },
        orderBy: [{ lastUsedAt: 'desc' }, { id: 'desc' }],
        skip: 5,
        select: { id: true },
      });
      if (extra.length)
        await tx.pushSubscription.deleteMany({
          where: { userId, id: { in: extra.map((x) => x.id) } },
        });
    }, this.client);
  }
  async remove(userId: string, endpoint: string) {
    await this.client.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
  async list(userId: string) {
    return (await this.client.pushSubscription.findMany({ where: { userId }, take: 5 })).map(
      (s) => ({
        id: s.id,
        userId: s.userId,
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }),
    );
  }
}
