import type { InputBundle, ScanEvent } from './types';
export function retryFor(event: ScanEvent, b: InputBundle): ScanEvent | null {
  const rate = b.scenario.profiles[b.incidentProfileId].retryAfterTimeoutRate;
  if (event.retry || b.retryPolicy === 'NO_RETRY' || (event.sequence % 100) / 100 >= rate)
    return null;
  return {
    ...event,
    t: event.t + 1,
    sentMs: event.sentMs + b.scenario.timeoutMs,
    retry: true,
    requestId: `${event.requestId}-retry`,
    idempotencyKey:
      b.retryPolicy === 'RETRY_SAME_KEY' ? event.idempotencyKey : `${event.idempotencyKey}-new`,
  };
}
