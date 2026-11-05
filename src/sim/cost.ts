import type { InputBundle } from './types';
export function totalCost(b: InputBundle): number {
  const s = b.scenario,
    c = b.configuration;
  return (
    s.tiers.app[c.appCapacity].cost +
    s.tiers.db[c.dbCapacity].cost +
    (c.cache === 'ON_READS_ONLY' ? s.cache.cost : 0) +
    (s.queue.enabled ? s.queue.cost : 0)
  );
}
