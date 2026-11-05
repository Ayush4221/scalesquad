import {
  AppError,
  type Comparison,
  type ConfigurationValues,
  type SimulationResult,
} from '@scalesquad/shared';
import type { ScenarioConfig } from '@scalesquad/scenario';
import { assertComparable, makeBundle, runSimulation } from './run';

export function compareRuns(before: SimulationResult, after: SimulationResult): Comparison {
  if (before.sharedInputHash !== after.sharedInputHash)
    throw new AppError('COMPARISON_INPUT_MISMATCH', 500);
  const keys = [
    'duplicateAdmissions',
    'validAdmissions',
    'p95LatencyMs',
    'queuePeak',
    'appUtilizationPeak',
    'dbUtilizationPeak',
    'totalCost',
  ] as const;
  const gateKeys = ['correctnessPassed', 'throughputPassed', 'budgetMet'] as const;
  const tradeoffs: string[] = [];
  if (after.p95LatencyMs < before.p95LatencyMs && !after.correctnessPassed)
    tradeoffs.push('Latency improved; correctness still fails.');
  if (after.totalCost > before.totalCost) tradeoffs.push('The repair costs more credits.');
  if (!after.budgetMet) tradeoffs.push('Cost is over budget.');
  if (!after.throughputPassed) tradeoffs.push('The admission target is still missed.');
  if (after.correctnessPassed && !before.correctnessPassed)
    tradeoffs.push('Duplicate admission risk fixed.');
  return {
    status: after.overallGatePassed ? 'PASSED' : 'FAILED',
    metrics: keys.map((metric) => ({ metric, before: before[metric], after: after[metric] })),
    gatesChanged: gateKeys
      .filter((g) => before[g] !== after[g])
      .map((gate) => ({ gate, before: before[gate], after: after[gate] })),
    tradeoffs,
  };
}
export function runMatchSimulations({
  presetConfig,
  repairedConfig,
  scenario,
}: {
  presetConfig: ConfigurationValues;
  repairedConfig: ConfigurationValues;
  scenario: ScenarioConfig;
}) {
  const first = makeBundle(scenario, presetConfig, 'normal');
  const second = makeBundle(scenario, presetConfig, 'incident');
  const third = makeBundle(scenario, repairedConfig, 'incident');
  assertComparable(second, third);
  const runs = [runSimulation(first), runSimulation(second), runSimulation(third)] as const;
  return { runs, comparison: compareRuns(runs[1], runs[2]) };
}
