import type { ScenarioConfig } from '@scalesquad/scenario';
export function overloadPenalty(util: number, l: ScenarioConfig['latency']): number {
  if (util <= l.overloadStartUtil) return 0;
  if (util <= l.steepStartUtil)
    return (
      ((util - l.overloadStartUtil) / (l.steepStartUtil - l.overloadStartUtil)) * l.linearPenaltyMs
    );
  return Math.min(l.maxPenaltyMs, l.linearPenaltyMs + (util - l.steepStartUtil) * l.steepPenaltyMs);
}
/** Nearest rank over both successful and timed-out processed requests. */
export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1))]!;
}
