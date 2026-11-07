import type { PushSubscriptionDto } from '@scalesquad/shared';
export interface PushRecord extends PushSubscriptionDto {
  id: string;
  userId: string;
}
export interface PushRepository {
  save(userId: string, value: PushSubscriptionDto, userAgent: string): Promise<void>;
  remove(userId: string, endpoint: string): Promise<void>;
  list(userId: string): Promise<PushRecord[]>;
}
export interface PushTransport {
  send(subscription: PushSubscriptionDto, payload: string): Promise<void>;
}
