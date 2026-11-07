import { describe, expect, it } from 'vitest';
import { loadScenario, buildEvidenceCard, toPublicScenario } from '../../src/scenario';
import { scenarioCatalog } from '../../src/constants/scenarios';
import { runMatchSimulations, makeBundle, simulate, assertComparable } from '../../src/sim';
import { CreateMatchSchema } from '../../src/shared';

describe('research-inspired mission catalog', () => {
  for (const mission of scenarioCatalog)
    it(`${mission.id} is deterministic, solvable and keeps evidence private`, () => {
      const s = loadScenario(mission.id);
      const result = runMatchSimulations({
        scenario: s,
        presetConfig: s.presetConfiguration,
        repairedConfig: s.referenceRepair,
      });
      expect(result.runs.map((r) => r.status)).toEqual(['PASSED', 'FAILED', 'PASSED']);
      const bundle = makeBundle(s, s.referenceRepair, 'incident');
      expect(simulate(bundle)).toEqual(simulate(bundle));
      expect(toPublicScenario(s).scenarioId).toBe(mission.id);
      expect(JSON.stringify(mission)).not.toContain('referenceRepair');
      expect(toPublicScenario(s)).not.toHaveProperty('profiles');
      expect(
        buildEvidenceCard('OPS', 'INCIDENT_EVIDENCE', s).facts.every((f) => f.text.length > 0),
      ).toBe(true);
    });
  it('rejects unknown missions and cross-mission comparisons', () => {
    expect(CreateMatchSchema.parse({}).scenarioId).toBe('campuspass');
    expect(CreateMatchSchema.safeParse({ scenarioId: 'unknown' }).success).toBe(false);
    expect(
      CreateMatchSchema.safeParse({ scenarioId: 'campuspass', referenceRepair: {} }).success,
    ).toBe(false);
    const a = loadScenario('retry-storm'),
      b = loadScenario('split-gates');
    expect(() =>
      assertComparable(
        makeBundle(a, a.referenceRepair, 'incident'),
        makeBundle(b, b.referenceRepair, 'incident'),
      ),
    ).toThrow();
  });
});
