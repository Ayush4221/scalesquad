import type { InputBundle, ScanEvent } from './types';
export function expandTraffic(b: InputBundle): ScanEvent[][] {
  let sequence = 0;
  return b.scenario.trafficSeries[b.trafficProfileId].map((count, t) => {
    const events: ScanEvent[] = [];
    for (let i = 0; i < count; i++) {
      const n = sequence++;
      events.push({
        t,
        sentMs: t * 1000 + (i * 1000) / count,
        gateId: b.scenario.gates[n % b.scenario.gates.length]!.id,
        passId: `P-${n % b.scenario.totalPasses}`,
        requestId: `R-${n}`,
        idempotencyKey: `K-${n}`,
        retry: false,
        sequence: n,
      });
    }
    const race = b.scenario.simultaneousScan;
    if (race.enabled && race.second === t && race.profiles.includes(b.incidentProfileId)) {
      for (const passId of race.passIds)
        for (const gateId of race.gateIds) {
          const n = sequence++;
          events.push({
            t,
            sentMs: t * 1000,
            passId,
            gateId,
            requestId: `R-${n}`,
            idempotencyKey: `K-${n}`,
            retry: false,
            sequence: n,
          });
        }
    }
    return events.sort((a, c) => a.sentMs - c.sentMs || a.sequence - c.sequence);
  });
}
