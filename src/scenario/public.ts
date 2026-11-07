import { CacheMode, Capacity, PublicScenario, RetryPolicy } from '@scalesquad/shared';
import type { ScenarioConfig } from './schema';

export function toPublicScenario(s: ScenarioConfig): PublicScenario {
  return PublicScenario.parse({
    scenarioId: s.scenarioId,
    scenarioVersion: s.scenarioVersion,
    title: s.title,
    deadlineSeconds: s.deadlineSeconds,
    requiredValidAdmissions: s.requiredValidAdmissions,
    budgetDisplayRange: s.budgetDisplayRange,
    presetConfiguration: s.presetConfiguration,
    choices: {
      capacity: Capacity.options,
      retryPolicy: RetryPolicy.options,
      cache: CacheMode.options,
    },
  });
}
