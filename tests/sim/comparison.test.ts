import { describe, it, expect } from 'vitest';
import { loadScenario } from '@scalesquad/scenario';
import { makeBundle, runSimulation, compareRuns } from '@scalesquad/sim';
import { initialState, step } from '../../src/sim/step';
import { expandTraffic } from '../../src/sim/traffic';
describe('repair tradeoffs and idempotent capacity', () => {
  it('read cache improves latency without changing write capacity or atomicity', () => {
    const s = loadScenario(),
      plain = makeBundle(s, s.referenceRepair, 'normal');
    const cached = makeBundle(s, { ...s.referenceRepair, cache: 'ON_READS_ONLY' }, 'normal');
    const event = expandTraffic(plain)[0]![0]!;
    const a = step(initialState(), [event], plain),
      b = step(initialState(), [event], cached);
    expect(b.latencies[0]).toBeLessThan(a.latencies[0]!);
    expect(b.passes[event.passId]?.commitMs).toBe(a.passes[event.passId]?.commitMs);
    expect(b.counters.dbUtilizationPeak).toBe(a.counters.dbUtilizationPeak);
    expect(
      runSimulation(
        makeBundle(
          s,
          { ...s.referenceRepair, cache: 'ON_READS_ONLY', atomicCheckin: false },
          'incident',
        ),
      ).correctnessPassed,
    ).toBe(false);
    const observed = b.observations[0]!;
    expect(observed.responseMs).toBeGreaterThanOrEqual(observed.commitMs!);
  });
  it('fixing duplicates and throughput while exceeding budget remains FAILED', () => {
    const s = loadScenario(),
      before = runSimulation(makeBundle(s, s.presetConfiguration, 'incident'));
    const after = runSimulation(
      makeBundle(s, { ...s.referenceRepair, appCapacity: 'HIGH', dbCapacity: 'HIGH' }, 'incident'),
    );
    const comparison = compareRuns(before, after);
    expect(after.correctnessPassed).toBe(true);
    expect(after.throughputPassed).toBe(true);
    expect(comparison.status).toBe('FAILED');
    expect(comparison.tradeoffs).toContain('Cost is over budget.');
    expect(comparison.gatesChanged).toEqual(
      expect.arrayContaining([{ gate: 'budgetMet', before: true, after: false }]),
    );
  });
  it('cached idempotency results do not consume authoritative DB write slots', () => {
    const s = structuredClone(loadScenario());
    s.tiers.db.MEDIUM.capacityRps = 1;
    const bundle = makeBundle(s, s.referenceRepair, 'normal'),
      event = expandTraffic(bundle)[0]![0]!;
    const state = initialState();
    state.idempotency[event.idempotencyKey] = {
      outcome: 'ACCEPTED',
      passId: event.passId,
      commitMs: 0,
    };
    const next = step(state, [event, { ...event, requestId: 'retry', retry: true }], bundle);
    expect(next.counters.dbUtilizationPeak).toBe(0);
    expect(next.counters.validAdmissions).toBe(1);
    expect(next.counters.duplicateAdmissions).toBe(0);
    expect(next.counters.retrySuccesses).toBe(1);
  });
});
