import { describe, it, expect } from 'vitest';
import { buildEvidenceCard, loadScenario, ScenarioConfigSchema } from '@scalesquad/scenario';
describe('scenario boundaries and evidence variants', () => {
  it('handles atomic preset, queue cost and no outage without inventing facts', () => {
    const s = structuredClone(loadScenario());
    s.presetConfiguration.atomicCheckin = true;
    s.queue.enabled = true;
    s.profiles.incident.outage = null;
    expect(buildEvidenceCard('DATA', 'BRIEFING', s).facts.some((f) => f.text.includes('ON'))).toBe(
      true,
    );
    expect(
      buildEvidenceCard('OPS', 'BRIEFING', s).facts.some((f) =>
        f.text.includes(String(s.queue.cost)),
      ),
    ).toBe(true);
    expect(
      buildEvidenceCard('OPS', 'INCIDENT_EVIDENCE', s).facts.some((f) =>
        f.text.includes('second 0'),
      ),
    ).toBe(true);
  });
  it('rejects duplicate gates, unknown outage gates, oversized traffic and invalid threshold ordering', () => {
    const { scenarioHash: _, ...base } = loadScenario();
    const values = [
      { ...base, gates: [{ id: 'A' }, { id: 'A' }] },
      {
        ...base,
        profiles: {
          ...base.profiles,
          incident: { ...base.profiles.incident, offlineGateIds: ['missing'] },
        },
      },
      {
        ...base,
        profiles: {
          ...base.profiles,
          incident: { ...base.profiles.incident, outage: { from: 0, to: 100 } },
        },
      },
      {
        ...base,
        deadlineSeconds: 600,
        trafficSeries: { normal: Array(600).fill(500), incident: Array(600).fill(500) },
      },
      { ...base, latency: { ...base.latency, steepStartUtil: base.latency.overloadStartUtil } },
    ];
    for (const v of values) expect(ScenarioConfigSchema.safeParse(v).success).toBe(false);
  });
});
