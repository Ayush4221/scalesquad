import type { z } from 'zod';
import type { PushSubscriptionSchema, PushPayload } from '../validations/push.schema';
export type PushSubscriptionDto = z.infer<typeof PushSubscriptionSchema>;
export type PushMessageDto = z.infer<typeof PushPayload>;
