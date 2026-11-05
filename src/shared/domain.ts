import { z } from 'zod';

export const Role = z.enum(['TRAFFIC', 'DATA', 'OPS']);
export type Role = z.infer<typeof Role>;
export const MatchPhase = z.enum([
  'LOBBY',
  'BRIEFING',
  'REPAIR_1',
  'RUNS_1_2',
  'INCIDENT_EVIDENCE',
  'REPAIR_2',
  'RUN_3',
  'COMPARE',
  'FINISHED',
]);
export type MatchPhase = z.infer<typeof MatchPhase>;
export const RunNumber = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type RunNumber = z.infer<typeof RunNumber>;
export const Outcome = z.enum([
  'ACCEPTED',
  'ALREADY_USED',
  'TIMEOUT',
  'PENDING_NOT_CONFIRMED',
  'QUEUE_FULL',
  'APP_OVER_CAPACITY',
  'RETRY',
]);
export const Capacity = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const AppCapacity = Capacity;
export const DbCapacity = Capacity;
export const RetryPolicy = z.enum(['NO_RETRY', 'RETRY_SAME_KEY', 'RETRY_NEW_IDENTITY']);
export type RetryPolicy = z.infer<typeof RetryPolicy>;
export const CacheMode = z.enum(['OFF', 'ON_READS_ONLY']);
export const ConfigurationValues = z
  .object({
    appCapacity: Capacity,
    dbCapacity: Capacity,
    atomicCheckin: z.boolean(),
    retryPolicy: RetryPolicy,
    cache: CacheMode,
  })
  .strict();
export type ConfigurationValues = z.infer<typeof ConfigurationValues>;
export const ConfigurationChange = ConfigurationValues.partial().refine(
  (value) => Object.keys(value).length > 0,
);
export const Id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const ConfigurationView = z
  .object({ version: z.number().int().nonnegative(), values: ConfigurationValues })
  .strict();
export type ConfigurationView = z.infer<typeof ConfigurationView>;
export const EvidencePhase = z.enum(['BRIEFING', 'INCIDENT_EVIDENCE']);
export type EvidencePhase = z.infer<typeof EvidencePhase>;
export const EvidenceCard = z
  .object({
    id: Id,
    phase: EvidencePhase,
    role: Role,
    private: z.literal(true),
    facts: z.array(z.object({ id: Id, text: z.string().max(1500) }).strict()).max(12),
  })
  .strict();
export type EvidenceCard = z.infer<typeof EvidenceCard>;

export const FailureReason = z
  .object({
    code: z.enum([
      'DUPLICATE_ADMISSION',
      'VALID_ADMISSION_TARGET_MISSED',
      'BUDGET_EXCEEDED',
      'QUEUE_OVERFLOW',
      'APP_SATURATED',
      'DB_SATURATED',
      'CACHE_USED_AS_AUTHORITY',
      'RETRY_IDENTITY_UNSAFE',
      'GATE_OUTAGE_UNCONFIRMED',
    ]),
    rule: z.string(),
    evidence: z.record(z.string(), z.union([z.number(), z.string()])),
    causedBy: z.array(z.string()),
    message: z.string(),
  })
  .strict();
export type FailureReason = z.infer<typeof FailureReason>;
const count = z.number().int().nonnegative();
export const SimulationResult = z
  .object({
    validAdmissions: count,
    duplicateAdmissions: count,
    rejectedAlreadyUsed: count,
    pendingAdmissions: count,
    timedOutRequests: count,
    retriedRequests: count,
    retrySuccesses: count,
    queuePeak: count,
    queueRejected: count,
    appUtilizationPeak: z.number().nonnegative(),
    dbUtilizationPeak: z.number().nonnegative(),
    p50LatencyMs: z.number().nonnegative(),
    p95LatencyMs: z.number().nonnegative(),
    admissionDeadlineMet: z.boolean(),
    totalCost: z.number().nonnegative(),
    budgetMet: z.boolean(),
    correctnessPassed: z.boolean(),
    throughputPassed: z.boolean(),
    overallGatePassed: z.boolean(),
    status: z.enum(['PASSED', 'FAILED']),
    failureReasons: z.array(FailureReason),
    inputHash: z.string().length(64),
    sharedInputHash: z.string().length(64),
    engineVersion: z.string(),
    scenarioVersion: z.string(),
  })
  .strict();
export type SimulationResult = z.infer<typeof SimulationResult>;
export const Comparison = z
  .object({
    status: z.enum(['PASSED', 'FAILED']),
    metrics: z.array(
      z.object({ metric: z.string(), before: z.number(), after: z.number() }).strict(),
    ),
    gatesChanged: z.array(
      z
        .object({
          gate: z.enum(['correctnessPassed', 'throughputPassed', 'budgetMet']),
          before: z.boolean(),
          after: z.boolean(),
        })
        .strict(),
    ),
    tradeoffs: z.array(z.string()),
  })
  .strict();
export type Comparison = z.infer<typeof Comparison>;
export const RunView = z.object({ runNumber: RunNumber, result: SimulationResult }).strict();
export type RunView = z.infer<typeof RunView>;
export const PublicScenario = z
  .object({
    scenarioId: z.string(),
    scenarioVersion: z.string(),
    title: z.string(),
    deadlineSeconds: count,
    requiredValidAdmissions: count,
    budgetDisplayRange: z.tuple([z.number(), z.number()]),
    presetConfiguration: ConfigurationValues,
    choices: z
      .object({
        capacity: z.array(Capacity),
        retryPolicy: z.array(RetryPolicy),
        cache: z.array(CacheMode),
      })
      .strict(),
  })
  .strict();
export type PublicScenario = z.infer<typeof PublicScenario>;
export const PublicMatchView = z
  .object({
    id: Id,
    revision: z.number().int().nonnegative(),
    hostUserId: Id,
    phase: MatchPhase,
    joinCode: z.string().nullable(),
    deadlineAt: z.number().nullable(),
    simulationLocked: z.boolean(),
    members: z
      .array(
        z
          .object({ userId: Id, name: z.string(), ready: z.boolean(), acknowledged: z.boolean() })
          .strict(),
      )
      .max(3),
    ownRole: Role.nullable(),
    configuration: ConfigurationView,
    lock: z.object({ holderUserId: Id, expiresAt: z.number() }).strict().nullable(),
    scenario: PublicScenario,
    runs: z.array(RunView).max(3),
    comparison: Comparison.nullable(),
    chatAvailable: z.boolean(),
    runError: z.boolean(),
  })
  .strict();
export type PublicMatchView = z.infer<typeof PublicMatchView>;
