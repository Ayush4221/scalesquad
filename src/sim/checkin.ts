export interface PassRecord {
  state: 'ACCEPTED';
  acceptedRequestId: string;
  acceptedGateId: string;
  readMs: number;
  commitMs: number;
}
export type PassStore = Record<string, PassRecord>;
export const emptyPassStore = (): PassStore => ({});
export function checkin(
  store: PassStore,
  input: {
    passId: string;
    requestId: string;
    gateId: string;
    readMs: number;
    commitMs: number;
    atomic: boolean;
    raceWindowMs: number;
  },
) {
  const result = decideCheckin(store, input);
  return { ...result, store: result.record ? { ...store, [input.passId]: result.record } : store };
}
export function decideCheckin(
  store: PassStore,
  input: {
    passId: string;
    requestId: string;
    gateId: string;
    readMs: number;
    commitMs: number;
    atomic: boolean;
    raceWindowMs: number;
  },
) {
  const prior = store[input.passId];
  const overlaps =
    prior !== undefined &&
    input.readMs < prior.commitMs &&
    input.readMs - prior.readMs < input.raceWindowMs;
  if (prior && (input.atomic || !overlaps))
    return { record: null, outcome: 'ALREADY_USED' as const, duplicate: false };
  const record: PassRecord = prior ?? {
    state: 'ACCEPTED',
    acceptedRequestId: input.requestId,
    acceptedGateId: input.gateId,
    readMs: input.readMs,
    commitMs: input.commitMs,
  };
  return { record, outcome: 'ACCEPTED' as const, duplicate: prior !== undefined };
}
