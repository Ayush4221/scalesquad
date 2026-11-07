import type { InputBundle } from './types';
export function gateOnline(b: InputBundle, gateId: string, t: number): boolean {
  const p = b.scenario.profiles[b.incidentProfileId];
  return !p.outage || !p.offlineGateIds.includes(gateId) || t < p.outage.from || t >= p.outage.to;
}
