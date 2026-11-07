import { describe, it, expect } from 'vitest';
import { Role, contentHash } from '@scalesquad/shared';
import {
  loadScenario,
  toPublicScenario,
  buildEvidenceCard,
  evidenceFacts,
  ScenarioConfigSchema,
} from '../../src/scenario/index';
describe('CampusPass versioned rules', () => {
  const s = loadScenario();
  it('is strict, valid, frozen, versioned and hash stable', () => {
    expect(s.scenarioHash).toBe(loadScenario().scenarioHash);
    expect(() => loadScenario('other')).toThrow();
    expect(() => loadScenario('campuspass', '2')).toThrow();
    expect(() => {
      s.tiers.app.LOW.cost = 0;
    }).toThrow();
    expect(ScenarioConfigSchema.safeParse({ ...s, unknown: true }).success).toBe(false);
  });
  it('tiers increase in capacity and cost; preset flawed, reference affordable', () => {
    for (const group of Object.values(s.tiers)) {
      expect(group.LOW.capacityRps).toBeLessThan(group.MEDIUM.capacityRps);
      expect(group.MEDIUM.capacityRps).toBeLessThan(group.HIGH.capacityRps);
      expect(group.LOW.cost).toBeLessThan(group.MEDIUM.cost);
      expect(group.MEDIUM.cost).toBeLessThan(group.HIGH.cost);
    }
    expect(s.presetConfiguration.atomicCheckin).toBe(false);
    expect(s.presetConfiguration.retryPolicy).toBe('RETRY_NEW_IDENTITY');
    expect(s.tiers.app.LOW.capacityRps).toBeLessThan(Math.max(...s.trafficSeries.incident));
    expect(s.tiers.app.MEDIUM.cost + s.tiers.db.MEDIUM.cost).toBeLessThanOrEqual(s.budgetLimit);
  });
  it('fact IDs are unique across roles and phases and all render', () => {
    const ids: string[] = [];
    for (const role of Role.options)
      for (const phase of ['BRIEFING', 'INCIDENT_EVIDENCE'] as const) {
        const card = buildEvidenceCard(role, phase, s);
        expect(card.facts.map((f) => f.id)).toEqual(evidenceFacts[role][phase]);
        for (const fact of card.facts) {
          expect(fact.text).not.toBe('');
          ids.push(fact.id);
        }
      }
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('evidence changes with actual incident config', () => {
    const altered = structuredClone(s);
    altered.profiles.incident.retryAfterTimeoutRate = 0.1;
    expect(buildEvidenceCard('TRAFFIC', 'INCIDENT_EVIDENCE', s)).not.toEqual(
      buildEvidenceCard('TRAFFIC', 'INCIDENT_EVIDENCE', altered),
    );
    expect(
      buildEvidenceCard('OPS', 'BRIEFING', s).facts.some((f) =>
        f.text.includes(String(s.budgetLimit)),
      ),
    ).toBe(true);
  });
  it('public projection has no hidden scenario data or repair', () => {
    const publicValue = toPublicScenario(s);
    for (const key of [
      'referenceRepair',
      'tiers',
      'trafficSeries',
      'profiles',
      'simultaneousScan',
      'match',
      'budgetLimit',
      'scenarioHash',
    ])
      expect(JSON.stringify(publicValue)).not.toContain(`"${key}"`);
    expect(contentHash(publicValue)).toBe(contentHash(toPublicScenario(s)));
  });
  it('rejects excessive event counts, missing seconds, unknown gates and invalid bounds', () => {
    const { scenarioHash: _, ...base } = s;
    expect(
      ScenarioConfigSchema.safeParse({
        ...base,
        trafficSeries: { ...base.trafficSeries, normal: [0] },
      }).success,
    ).toBe(false);
    expect(
      ScenarioConfigSchema.safeParse({ ...base, requiredValidAdmissions: 50000 }).success,
    ).toBe(false);
    expect(
      ScenarioConfigSchema.safeParse({
        ...base,
        simultaneousScan: { ...base.simultaneousScan, gateIds: ['X', 'Y'] },
      }).success,
    ).toBe(false);
  });
});
