import { z } from '../utils/validation';
import { ConfigurationValues, ScenarioId } from '@scalesquad/shared';

const positive = z.number().finite().positive();
const count = z.number().int().nonnegative();
const tier = z.object({ capacityRps: positive, baseLatencyMs: positive, cost: positive }).strict();
const tiers = z.object({ LOW: tier, MEDIUM: tier, HIGH: tier }).strict();
const window = z
  .object({ from: count, to: count })
  .strict()
  .refine((v) => v.to > v.from);
const profile = z
  .object({
    version: z.string().max(30),
    retryAfterTimeoutRate: z.number().min(0).max(1),
    outage: window.nullable(),
    offlineGateIds: z.array(z.string()).max(8),
    committedTimeoutPassIds: z.array(z.string()).max(100),
    staleReplica: z.boolean(),
  })
  .strict();
export const ScenarioConfigSchema = z
  .object({
    scenarioId: ScenarioId,
    scenarioVersion: z.string().max(30),
    engineCompat: z.array(z.string()).min(1).max(10),
    title: z.string().max(100),
    deadlineSeconds: z.number().int().min(1).max(600),
    graceSeconds: z.number().int().min(0).max(60),
    requiredValidAdmissions: z.number().int().min(1).max(50000),
    totalPasses: z.number().int().min(1).max(50000),
    timeoutMs: positive,
    raceWindowMs: positive,
    trafficSeries: z
      .object({
        normal: z.array(count.max(500)).min(1).max(600),
        incident: z.array(count.max(500)).min(1).max(600),
      })
      .strict(),
    tiers: z.object({ app: tiers, db: tiers }).strict(),
    cache: z
      .object({
        cost: positive,
        readLatencyMs: positive,
        staleReadProbabilityRule: z.literal('NON_AUTHORITATIVE_ONLY'),
      })
      .strict(),
    queue: z
      .object({
        enabled: z.boolean(),
        maxBacklog: count.max(10000),
        workerRate: positive,
        cost: positive,
      })
      .strict(),
    latency: z
      .object({
        overloadStartUtil: positive,
        steepStartUtil: positive,
        linearPenaltyMs: positive,
        steepPenaltyMs: positive,
        maxPenaltyMs: positive,
      })
      .strict(),
    budgetLimit: positive,
    budgetDisplayRange: z.tuple([positive, positive]),
    gates: z
      .array(z.object({ id: z.string().min(1).max(20) }).strict())
      .min(2)
      .max(8),
    profiles: z.object({ normal: profile, incident: profile }).strict(),
    simultaneousScan: z
      .object({
        enabled: z.boolean(),
        second: count,
        passIds: z.array(z.string()).min(1).max(20),
        gateIds: z.array(z.string()).min(2).max(8),
        profiles: z.array(z.enum(['normal', 'incident'])).max(2),
      })
      .strict(),
    presetConfiguration: ConfigurationValues,
    referenceRepair: ConfigurationValues,
    match: z
      .object({
        joinCodeTtlMs: positive,
        briefDurationMs: positive,
        incidentDurationMs: positive,
        compareDurationMs: positive,
        lockLeaseMs: positive,
        reclaimAfterMs: positive,
        runTimeoutMs: positive,
      })
      .strict(),
  })
  .strict()
  .superRefine((s, ctx) => {
    for (const series of Object.values(s.trafficSeries)) {
      if (series.length !== s.deadlineSeconds || series.reduce((a, b) => a + b, 0) > 100000)
        ctx.addIssue({ code: 'custom', message: 'Traffic bounds invalid' });
    }
    if (
      s.requiredValidAdmissions > s.totalPasses ||
      s.latency.steepStartUtil <= s.latency.overloadStartUtil ||
      s.simultaneousScan.second >= s.deadlineSeconds
    )
      ctx.addIssue({ code: 'custom', message: 'Scenario bounds invalid' });
    const ids = s.gates.map((g) => g.id);
    if (
      new Set(ids).size !== ids.length ||
      s.simultaneousScan.gateIds.some((id) => !ids.includes(id))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid gate IDs' });
    for (const p of Object.values(s.profiles)) {
      if (
        p.offlineGateIds.some((id) => !ids.includes(id)) ||
        (p.outage && p.outage.to > s.deadlineSeconds + s.graceSeconds)
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid outage' });
    }
  });
export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;
