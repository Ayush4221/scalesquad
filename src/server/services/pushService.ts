import {
  requireUser,
  PushSubscriptionSchema,
  PushPayload,
  type PushMessageDto,
  type PushSubscriptionDto,
} from '@scalesquad/shared';
import type { PushRepository, PushTransport } from '../infra/push';
import { KeyedQueue } from '../utils/keyedQueue';
export class PushService {
  private readonly queue = new KeyedQueue();
  constructor(
    private readonly repo: PushRepository,
    private readonly transport: PushTransport | null,
    private readonly foreground: (userId: string) => boolean,
    readonly publicKey: string,
  ) {}
  async subscribe(userId: string | null, value: PushSubscriptionDto, userAgent: string) {
    requireUser(userId);
    await this.queue.run(userId, () =>
      this.repo.save(userId, PushSubscriptionSchema.parse(value), userAgent.slice(0, 200)),
    );
    return { ok: true };
  }
  async unsubscribe(userId: string | null, endpoint: string) {
    requireUser(userId);
    await this.repo.remove(userId, endpoint);
    return { ok: true };
  }
  async notify(userId: string, kind: PushMessageDto['kind'], matchId: string) {
    try {
      const payload = JSON.stringify(PushPayload.parse({ kind, matchId }));
      if (!this.transport || this.foreground(userId)) return;
      for (const subscription of await this.repo.list(userId)) {
        try {
          await this.transport.send(subscription, payload);
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            [404, 410].includes(Number(error.statusCode))
          )
            await this.repo.remove(userId, subscription.endpoint);
        }
      }
    } catch {
      /* Push is advisory; it must never fail a game action or log private endpoint keys. */
    }
  }
}
