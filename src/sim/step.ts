import { decideCheckin, type PassStore } from './checkin';
import { gateOnline } from './gates';
import { overloadPenalty } from './latency';
import { retryFor } from './retry';
import type { Counters, InputBundle, ScanEvent, GateScan } from './types';

export interface State {
  t: number;
  passes: PassStore;
  pending: ScanEvent[];
  queue: ScanEvent[];
  retries: ScanEvent[];
  idempotency: Record<
    string,
    { outcome: 'ACCEPTED' | 'ALREADY_USED'; passId: string; commitMs: number }
  >;
  confirmed: string[];
  confirmedIndex: Record<string, true>;
  latencies: number[];
  observations: GateScan[];
  counters: Counters;
}
export function initialState(): State {
  return {
    t: 0,
    passes: {},
    pending: [],
    queue: [],
    retries: [],
    idempotency: {},
    confirmed: [],
    confirmedIndex: {},
    latencies: [],
    observations: [],
    counters: {
      validAdmissions: 0,
      duplicateAdmissions: 0,
      rejectedAlreadyUsed: 0,
      timedOutRequests: 0,
      retriedRequests: 0,
      retrySuccesses: 0,
      queuePeak: 0,
      queueRejected: 0,
      appUtilizationPeak: 0,
      dbUtilizationPeak: 0,
    },
  };
}
/** A second is a pure state transition. Nothing escapes through a hidden mutable store. */
export function step(previous: State, arrivals: readonly ScanEvent[], b: InputBundle): State {
  return advance(previous, arrivals, b, true);
}
/** Only simulate() owns this state; transfer its cumulative stores without copying. */
export function advanceOwnedState(
  previous: State,
  arrivals: readonly ScanEvent[],
  b: InputBundle,
): State {
  return advance(previous, arrivals, b, false);
}
function advance(
  previous: State,
  arrivals: readonly ScanEvent[],
  b: InputBundle,
  preserve: boolean,
): State {
  const state: State = {
    ...previous,
    passes: preserve ? { ...previous.passes } : previous.passes,
    pending: [],
    queue: [...previous.queue],
    retries: [],
    idempotency: preserve ? { ...previous.idempotency } : previous.idempotency,
    confirmed: preserve ? [...previous.confirmed] : previous.confirmed,
    confirmedIndex: preserve ? { ...previous.confirmedIndex } : previous.confirmedIndex,
    latencies: preserve ? [...previous.latencies] : previous.latencies,
    observations: [],
    counters: { ...previous.counters },
  };
  const s = b.scenario,
    c = b.configuration,
    t = state.t;
  const app = s.tiers.app[c.appCapacity],
    db = s.tiers.db[c.dbCapacity];
  const available: ScanEvent[] = [];
  for (const e of previous.pending) {
    if (gateOnline(b, e.gateId, t)) available.push({ ...e, t, sentMs: t * 1000 });
    else state.pending.push(e);
  }
  for (const e of [...previous.retries, ...arrivals]) {
    if (gateOnline(b, e.gateId, t)) available.push(e);
    else {
      state.pending.push(e);
      state.observations.push({
        ...e,
        commitMs: null,
        responseMs: t * 1000,
        outcome: 'PENDING_NOT_CONFIRMED',
      });
    }
  }
  const count = state.counters;
  const appUtil = (available.length + state.queue.length) / app.capacityRps;
  count.appUtilizationPeak = Math.max(count.appUtilizationPeak, appUtil);
  let processing: ScanEvent[];
  if (s.queue.enabled) {
    const all = [...state.queue, ...available];
    const workers = Math.floor(Math.min(s.queue.workerRate, app.capacityRps, db.capacityRps));
    processing = all.slice(0, workers);
    const waiting = all.slice(workers);
    count.queueRejected += Math.max(0, waiting.length - s.queue.maxBacklog);
    state.observations.push(
      ...waiting.slice(s.queue.maxBacklog).map((e) => ({
        ...e,
        commitMs: null,
        responseMs: t * 1000,
        outcome: 'QUEUE_FULL' as const,
      })),
    );
    state.queue = waiting.slice(0, s.queue.maxBacklog);
    count.queuePeak = Math.max(count.queuePeak, state.queue.length);
  } else {
    processing = available.slice(0, Math.floor(app.capacityRps));
    for (const event of available.slice(processing.length)) {
      state.observations.push({
        ...event,
        commitMs: null,
        responseMs: t * 1000,
        outcome: 'APP_OVER_CAPACITY',
      });
    }
  }
  const writes = new Set(
    processing.filter((e) => !state.idempotency[e.idempotencyKey]).map((e) => e.idempotencyKey),
  );
  const dbUtil = writes.size / db.capacityRps;
  count.dbUtilizationPeak = Math.max(count.dbUtilizationPeak, dbUtil);
  let writeIndex = 0;
  for (const event of processing) {
    const cached = state.idempotency[event.idempotencyKey];
    const waitMs = Math.max(0, t * 1000 - event.sentMs);
    const latency = Math.max(
      db.baseLatencyMs,
      app.baseLatencyMs +
        (c.cache === 'ON_READS_ONLY' ? s.cache.readLatencyMs : db.baseLatencyMs) +
        waitMs +
        overloadPenalty(appUtil, s.latency) +
        overloadPenalty(dbUtil, s.latency),
    );
    if (!cached && writeIndex++ >= db.capacityRps) {
      count.timedOutRequests++;
      state.latencies.push(Math.max(s.timeoutMs, latency));
      state.observations.push({
        ...event,
        commitMs: null,
        responseMs: Math.max(t * 1000, event.sentMs) + s.timeoutMs,
        outcome: 'TIMEOUT',
      });
      const retry = retryFor(event, b);
      if (retry) {
        state.retries.push(retry);
        count.retriedRequests++;
      }
      continue;
    }
    const readMs = Math.max(t * 1000, event.sentMs);
    const commitMs = readMs + db.baseLatencyMs;
    let outcome: 'ACCEPTED' | 'ALREADY_USED';
    if (cached) outcome = cached.outcome;
    else {
      const result = decideCheckin(state.passes, {
        ...event,
        readMs,
        commitMs,
        atomic: c.atomicCheckin,
        raceWindowMs: s.raceWindowMs,
      });
      if (result.record) state.passes[event.passId] = result.record;
      outcome = result.outcome;
      if (result.duplicate) count.duplicateAdmissions++;
      state.idempotency[event.idempotencyKey] = { outcome, passId: event.passId, commitMs };
    }
    const forcedTimeout =
      !event.retry &&
      s.profiles[b.incidentProfileId].committedTimeoutPassIds.includes(event.passId);
    const actualLatency = forcedTimeout
      ? Math.max(latency, s.timeoutMs + db.baseLatencyMs)
      : latency;
    state.latencies.push(actualLatency);
    state.observations.push({
      ...event,
      commitMs: cached?.commitMs ?? commitMs,
      responseMs: readMs + actualLatency,
      outcome: actualLatency > s.timeoutMs ? 'TIMEOUT' : outcome,
    });
    if (actualLatency > s.timeoutMs) {
      count.timedOutRequests++;
      const retry = retryFor({ ...event, t }, b);
      if (retry) {
        state.retries.push(retry);
        count.retriedRequests++;
      }
    } else if (outcome === 'ALREADY_USED') count.rejectedAlreadyUsed++;
    else {
      if (event.retry) count.retrySuccesses++;
      if (
        !state.confirmedIndex[event.passId] &&
        Math.max(readMs + actualLatency, cached?.commitMs ?? commitMs) <= s.deadlineSeconds * 1000
      ) {
        state.confirmedIndex[event.passId] = true;
        state.confirmed.push(event.passId);
        count.validAdmissions++;
      }
    }
  }
  state.t++;
  return state;
}
