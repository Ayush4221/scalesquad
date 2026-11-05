import { z } from 'zod';
import { Id } from '../domain';
export const PushKind = z.enum([
  'MATCH_STARTED',
  'EVIDENCE_AVAILABLE',
  'LOCK_PASSED_TO_YOU',
  'RUN_COMPLETED',
  'MATCH_FINISHED',
]);
export const PushPayload = z.object({ kind: PushKind, matchId: Id }).strict();
export function allowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase();
    return (
      value.length <= 2048 &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        (host.endsWith('.push.apple.com') && host !== '.push.apple.com') ||
        (host.endsWith('.notify.windows.com') && host !== '.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
export const PushEndpoint = z
  .string()
  .max(2048)
  .refine(allowedPushEndpoint, 'Unsupported push service');
const base64Key = (bytes: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .refine((value) => {
      const raw = value.replace(/=+$/, '');
      return Math.floor((raw.length * 3) / 4) === bytes;
    });
export const PushSubscriptionSchema = z
  .object({
    endpoint: PushEndpoint,
    keys: z.object({ p256dh: base64Key(65), auth: base64Key(16) }).strict(),
  })
  .strict();
export const RemovePushSchema = z.object({ endpoint: PushEndpoint }).strict();
