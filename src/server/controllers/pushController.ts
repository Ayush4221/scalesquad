import { parse, PushSubscriptionSchema, RemovePushSchema } from '@scalesquad/shared';
import type { PushService } from '../services/pushService';
import type { Context } from './gameController';
export function pushControllers(service: PushService) {
  return {
    pushKey: async () => ({ publicKey: service.publicKey }),
    pushSubscribe: async (c: Context) =>
      service.subscribe(c.userId, parse(PushSubscriptionSchema, c.body), c.userAgent ?? ''),
    pushUnsubscribe: async (c: Context) =>
      service.unsubscribe(c.userId, parse(RemovePushSchema, c.body).endpoint),
  };
}
