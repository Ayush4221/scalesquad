import { z } from 'zod';
import { ConfigurationValues, RetryPolicy } from '@scalesquad/shared';
import { ScenarioConfigSchema } from '@scalesquad/scenario';
export const ENGINE_VERSION = '1.0.0';
export const InputBundleSchema = z
  .object({
    scenario: ScenarioConfigSchema,
    scenarioVersion: z.string(),
    configuration: ConfigurationValues,
    configurationVersion: z.number().int().nonnegative(),
    trafficProfileId: z.enum(['normal', 'incident']),
    incidentProfileId: z.enum(['normal', 'incident']),
    retryPolicy: RetryPolicy,
    engineVersion: z.string(),
    cacheAsAuthority: z.boolean().optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.scenarioVersion === b.scenario.scenarioVersion &&
      b.retryPolicy === b.configuration.retryPolicy &&
      b.scenario.engineCompat.includes(b.engineVersion),
  );
export type InputBundle = z.infer<typeof InputBundleSchema>;
export interface ScanEvent {
  t: number;
  sentMs: number;
  gateId: string;
  passId: string;
  requestId: string;
  idempotencyKey: string;
  retry: boolean;
  sequence: number;
}
export interface GateScan extends ScanEvent {
  commitMs: number | null;
  responseMs: number;
  outcome:
    | 'ACCEPTED'
    | 'ALREADY_USED'
    | 'TIMEOUT'
    | 'PENDING_NOT_CONFIRMED'
    | 'QUEUE_FULL'
    | 'APP_OVER_CAPACITY';
}
export interface Counters {
  validAdmissions: number;
  duplicateAdmissions: number;
  rejectedAlreadyUsed: number;
  timedOutRequests: number;
  retriedRequests: number;
  retrySuccesses: number;
  queuePeak: number;
  queueRejected: number;
  appUtilizationPeak: number;
  dbUtilizationPeak: number;
}
