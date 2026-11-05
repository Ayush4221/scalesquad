import webpush from 'web-push';
import { PushSubscriptionSchema, PushPayload, type PushSubscriptionDto } from '@scalesquad/shared';
import type { PushTransport } from './push';
import { Semaphore } from './semaphore';
const sending = new Semaphore(4, 64);
export class WebPushTransport implements PushTransport {
  constructor(
    private readonly vapid: { subject: string; publicKey: string; privateKey: string },
    private readonly sendNotification = webpush.sendNotification,
  ) {}
  async send(subscription: PushSubscriptionDto, payload: string): Promise<void> {
    const safeSubscription = PushSubscriptionSchema.parse(subscription),
      safePayload = JSON.stringify(PushPayload.parse(JSON.parse(payload) as unknown));
    await sending.run(async () => {
      await this.sendNotification(safeSubscription, safePayload, {
        vapidDetails: this.vapid,
        TTL: 60,
        urgency: 'high',
        timeout: 5000,
        contentEncoding: 'aes128gcm',
      });
    });
  }
}
