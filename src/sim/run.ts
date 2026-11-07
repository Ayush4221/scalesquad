import {
  AppError,
  contentHash,
  parse,
  type ConfigurationValues,
  type FailureReason,
  type SimulationResult,
} from '@scalesquad/shared';
import { formatPercent } from '../utils/formatMetric';
import { ScenarioConfigSchema, type ScenarioConfig } from '@scalesquad/scenario';
import { ENGINE_VERSION, InputBundleSchema, type InputBundle } from './types';
import { expandTraffic } from './traffic';
import { initialState, step, advanceOwnedState, type State } from './step';
import { percentile } from './latency';
import { totalCost } from './cost';

export function makeBundle(
  scenario: ScenarioConfig,
  configuration: ConfigurationValues,
  profile: 'normal' | 'incident',
  version = 0,
): InputBundle {
  return {
    scenario: ScenarioConfigSchema.parse(
      Object.fromEntries(Object.entries(scenario).filter(([key]) => key !== 'scenarioHash')),
    ),
    scenarioVersion: scenario.scenarioVersion,
    configuration,
    configurationVersion: version,
    trafficProfileId: profile,
    incidentProfileId: profile,
    retryPolicy: configuration.retryPolicy,
    engineVersion: ENGINE_VERSION,
  };
}
export function sharedInputs(b: InputBundle) {
  return {
    scenario: b.scenario,
    scenarioVersion: b.scenarioVersion,
    trafficProfileId: b.trafficProfileId,
    incidentProfileId: b.incidentProfileId,
    engineVersion: b.engineVersion,
  };
}
export function assertComparable(a: InputBundle, b: InputBundle): void {
  if (contentHash(sharedInputs(a)) !== contentHash(sharedInputs(b)))
    throw new AppError('COMPARISON_INPUT_MISMATCH', 500);
}
export function evaluateGates(
  duplicates: number,
  valid: number,
  cost: number,
  s: Pick<ScenarioConfig, 'requiredValidAdmissions' | 'budgetLimit'>,
  unsafeCache = false,
) {
  const correctnessPassed = duplicates === 0 && !unsafeCache;
  const throughputPassed = valid >= s.requiredValidAdmissions;
  const budgetMet = cost <= s.budgetLimit;
  return {
    correctnessPassed,
    throughputPassed,
    budgetMet,
    admissionDeadlineMet: throughputPassed,
    overallGatePassed: correctnessPassed && throughputPassed && budgetMet,
  };
}
export function failureReasons(b: InputBundle, state: State, cost: number): FailureReason[] {
  const c = state.counters,
    s = b.scenario;
  const reasons: FailureReason[] = [];
  const add = (
    code: FailureReason['code'],
    rule: string,
    evidence: FailureReason['evidence'],
    causedBy: string[],
    message: string,
  ) => reasons.push({ code, rule, evidence, causedBy, message });
  if (c.duplicateAdmissions)
    add(
      'DUPLICATE_ADMISSION',
      'atomicCheckin=false',
      { count: c.duplicateAdmissions },
      ['atomicCheckin'],
      `${c.duplicateAdmissions} duplicate admissions from overlapping non-atomic writes.`,
    );
  if (c.validAdmissions < s.requiredValidAdmissions)
    add(
      'VALID_ADMISSION_TARGET_MISSED',
      'validAdmissions>=requiredValidAdmissions',
      { valid: c.validAdmissions, required: s.requiredValidAdmissions },
      ['appCapacity', 'dbCapacity', 'retryPolicy'],
      `${c.validAdmissions} of ${s.requiredValidAdmissions} required admissions confirmed before the deadline.`,
    );
  if (cost > s.budgetLimit)
    add(
      'BUDGET_EXCEEDED',
      'totalCost<=budgetLimit',
      { cost, budget: s.budgetLimit },
      ['appCapacity', 'dbCapacity', 'cache'],
      `Design costs ${cost} credits; budget is ${s.budgetLimit}.`,
    );
  if (b.cacheAsAuthority)
    add(
      'CACHE_USED_AS_AUTHORITY',
      'cache is non-authoritative',
      { mode: 'authoritative' },
      ['cache'],
      'Cache cannot authorize single-use admission.',
    );
  if (c.queueRejected)
    add(
      'QUEUE_OVERFLOW',
      'backlog<=maxBacklog',
      { rejected: c.queueRejected, limit: s.queue.maxBacklog },
      ['appCapacity', 'dbCapacity'],
      `${c.queueRejected} requests rejected because the queue is full.`,
    );
  if (c.appUtilizationPeak > s.latency.steepStartUtil)
    add(
      'APP_SATURATED',
      'appUtilization>steepStartUtil',
      { utilization: c.appUtilizationPeak },
      ['appCapacity'],
      `App peak utilization: ${formatPercent(c.appUtilizationPeak)}.`,
    );
  if (c.dbUtilizationPeak > s.latency.steepStartUtil)
    add(
      'DB_SATURATED',
      'dbUtilization>steepStartUtil',
      { utilization: c.dbUtilizationPeak },
      ['dbCapacity'],
      `DB peak utilization: ${formatPercent(c.dbUtilizationPeak)}.`,
    );
  if (c.retriedRequests && b.retryPolicy === 'RETRY_NEW_IDENTITY')
    add(
      'RETRY_IDENTITY_UNSAFE',
      'retry uses a new identity',
      { retries: c.retriedRequests },
      ['retryPolicy'],
      `${c.retriedRequests} retries did not preserve the original identity.`,
    );
  if (state.pending.length)
    add(
      'GATE_OUTAGE_UNCONFIRMED',
      'offline scans fail closed',
      { pending: state.pending.length },
      [],
      `${state.pending.length} offline scans remain unconfirmed.`,
    );
  const severity: Record<FailureReason['code'], number> = {
    DUPLICATE_ADMISSION: 0,
    CACHE_USED_AS_AUTHORITY: 0,
    VALID_ADMISSION_TARGET_MISSED: 1,
    BUDGET_EXCEEDED: 2,
    QUEUE_OVERFLOW: 3,
    APP_SATURATED: 4,
    DB_SATURATED: 4,
    RETRY_IDENTITY_UNSAFE: 5,
    GATE_OUTAGE_UNCONFIRMED: 5,
  };
  return reasons.sort(
    (a, c) => severity[a.code] - severity[c.code] || a.code.localeCompare(c.code, 'en'),
  );
}
export function simulate(
  input: unknown,
  trace = false,
): { result: SimulationResult; trace: State[] } {
  const b = parse(InputBundleSchema, input);
  const arrivals = expandTraffic(b);
  let state = initialState();
  const states: State[] = [];
  for (let t = 0; t < b.scenario.deadlineSeconds + b.scenario.graceSeconds; t++) {
    state = (trace ? step : advanceOwnedState)(state, arrivals[t] ?? [], b);
    if (trace) states.push(state);
  }
  const cost = totalCost(b);
  const gates = evaluateGates(
    state.counters.duplicateAdmissions,
    state.counters.validAdmissions,
    cost,
    b.scenario,
    b.cacheAsAuthority,
  );
  const result: SimulationResult = {
    ...state.counters,
    pendingAdmissions: state.pending.length + state.queue.length + state.retries.length,
    p50LatencyMs: percentile(state.latencies, 0.5),
    p95LatencyMs: percentile(state.latencies, 0.95),
    ...gates,
    totalCost: cost,
    status: gates.overallGatePassed ? 'PASSED' : 'FAILED',
    failureReasons: failureReasons(b, state, cost),
    inputHash: contentHash(b),
    sharedInputHash: contentHash(sharedInputs(b)),
    engineVersion: b.engineVersion,
    scenarioVersion: b.scenarioVersion,
  };
  return { result, trace: states };
}
export const runSimulation = (input: unknown): SimulationResult => simulate(input).result;
