import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { contentHash, SimulationResult, deepFreeze } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import {
  assertComparable,
  makeBundle,
  runSimulation,
  simulate,
  evaluateGates,
  runMatchSimulations,
  compareRuns,
} from '../../src/sim/index';
import { gateOnline } from '../../src/sim/gates';
import { retryFor } from '../../src/sim/retry';
import { expandTraffic } from '../../src/sim/traffic';
import { initialState, step } from '../../src/sim/step';
import { totalCost } from '../../src/sim/cost';
describe('deterministic simulator and fair comparison', () => {
  const s = loadScenario(),
    incident = makeBundle(s, s.presetConfiguration, 'incident'),
    repair = makeBundle(s, s.referenceRepair, 'incident');
  it('preset fails duplicates and capacity; reference repair passes; baseline passes as intended', () => {
    const output = runMatchSimulations({
      scenario: s,
      presetConfig: s.presetConfiguration,
      repairedConfig: s.referenceRepair,
    });
    expect(output.runs.map((r) => r.status)).toEqual(['PASSED', 'FAILED', 'PASSED']);
    expect(output.runs[1].failureReasons.map((f) => f.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_ADMISSION',
        'VALID_ADMISSION_TARGET_MISSED',
        'APP_SATURATED',
      ]),
    );
    expect(SimulationResult.safeParse(output.runs[2]).success).toBe(true);
  });
  it('100 repetitions per run are identical, including hashes', () => {
    for (const b of [makeBundle(s, s.presetConfiguration, 'normal'), incident, repair]) {
      const first = runSimulation(b);
      for (let i = 0; i < 100; i++) expect(runSimulation(b)).toEqual(first);
    }
  }, 120000);
  it('frozen input is not mutated, key order irrelevant and traces match', () => {
    const b = deepFreeze(structuredClone(repair));
    const hash = contentHash(b);
    const first = simulate(b, true);
    expect(simulate(b, true)).toEqual(first);
    expect(contentHash(b)).toBe(hash);
    expect(runSimulation({ ...b, configuration: { ...b.configuration } })).toEqual(first.result);
  });
  it.each(Array.from({ length: 8 }, (_, i) => i))('all hard gate combinations %s', (i) => {
    const a = (i & 1) !== 0,
      b = (i & 2) !== 0,
      c = (i & 4) !== 0;
    expect(
      evaluateGates(a ? 0 : 1, b ? 10 : 0, c ? 5 : 6, {
        requiredValidAdmissions: 10,
        budgetLimit: 5,
      }).overallGatePassed,
    ).toBe(a && b && c);
  });
  it('fast incorrect, slow correct, over-budget and cache-authority fail hard', () => {
    const result = (changes: Partial<typeof repair.configuration>) =>
      runSimulation({
        ...repair,
        configuration: { ...repair.configuration, ...changes },
        retryPolicy: changes.retryPolicy ?? repair.retryPolicy,
      });
    expect(
      result({ appCapacity: 'HIGH', dbCapacity: 'HIGH', atomicCheckin: false }).correctnessPassed,
    ).toBe(false);
    expect(result({ appCapacity: 'LOW', dbCapacity: 'LOW' }).throughputPassed).toBe(false);
    expect(result({ appCapacity: 'HIGH', dbCapacity: 'HIGH' }).budgetMet).toBe(false);
    expect(
      runSimulation({ ...repair, cacheAsAuthority: true }).failureReasons.some(
        (f) => f.code === 'CACHE_USED_AS_AUTHORITY',
      ),
    ).toBe(true);
    expect(evaluateGates(0, 2500, 100, s).overallGatePassed).toBe(true);
    expect(evaluateGates(0, 2500, 101, s).budgetMet).toBe(false);
  });
  it('comparison hashes every shared condition; lower latency cannot excuse duplicates', () => {
    expect(() => assertComparable(incident, repair)).not.toThrow();
    const changed = structuredClone(repair);
    changed.scenario.profiles.incident.retryAfterTimeoutRate = 0.5;
    expect(() => assertComparable(incident, changed)).toThrow(
      'These runs used different conditions and cannot be compared.',
    );
    const before = runSimulation(incident),
      after = { ...before, p95LatencyMs: 0 };
    expect(compareRuns(before, after).status).toBe('FAILED');
    expect(compareRuns(before, after).tradeoffs).toContain(
      'Latency improved; correctness still fails.',
    );
    expect(() => compareRuns(before, { ...after, sharedInputHash: '0'.repeat(64) })).toThrow();
  });
  it('timeout after commit persists; same key recovers once; new identity is not recovery', () => {
    const b = structuredClone(repair);
    b.scenario.trafficSeries.incident = Array(60).fill(0) as number[];
    b.scenario.trafficSeries.incident[0] = 1;
    b.scenario.simultaneousScan.enabled = false;
    b.scenario.profiles.incident.committedTimeoutPassIds = ['P-0'];
    const r = simulate(b, true);
    expect(r.trace[0]?.passes['P-0']?.state).toBe('ACCEPTED');
    expect(r.trace[0]?.counters.timedOutRequests).toBe(1);
    expect(r.result.validAdmissions).toBe(1);
    expect(r.result.retrySuccesses).toBe(1);
    expect(r.result.duplicateAdmissions).toBe(0);
    const newIdentity = {
      ...b,
      configuration: { ...b.configuration, retryPolicy: 'RETRY_NEW_IDENTITY' as const },
      retryPolicy: 'RETRY_NEW_IDENTITY' as const,
    };
    expect(runSimulation(newIdentity).rejectedAlreadyUsed).toBe(1);
    expect(runSimulation(newIdentity).validAdmissions).toBe(0);
    const noRetry = {
      ...b,
      configuration: { ...b.configuration, retryPolicy: 'NO_RETRY' as const },
      retryPolicy: 'NO_RETRY' as const,
    };
    expect(runSimulation(noRetry).retriedRequests).toBe(0);
  });
  it('offline scans fail closed; reconnection keeps key; late work cannot meet deadline', () => {
    const b = structuredClone(repair);
    b.scenario.profiles.incident.outage = { from: 0, to: 60 };
    b.scenario.profiles.incident.offlineGateIds = b.scenario.gates.map((g) => g.id);
    const r = runSimulation(b);
    expect(r.validAdmissions).toBe(0);
    expect(gateOnline(b, 'A', 0)).toBe(false);
    expect(gateOnline(b, 'A', 60)).toBe(true);
    b.scenario.profiles.incident.outage.to = 70;
    expect(runSimulation(b).pendingAdmissions).toBeGreaterThan(0);
  });
  it('queue buffers with real waiting, overflows, never fixes atomicity', () => {
    const b = structuredClone(incident);
    b.scenario.queue.enabled = true;
    b.scenario.queue.maxBacklog = 10;
    b.scenario.queue.workerRate = 40;
    const r = runSimulation(b);
    expect(r.queuePeak).toBe(10);
    expect(r.queueRejected).toBeGreaterThan(0);
    const strong = structuredClone(incident);
    strong.configuration.appCapacity = 'HIGH';
    strong.configuration.dbCapacity = 'HIGH';
    strong.scenario.queue.enabled = true;
    strong.scenario.queue.workerRate = 300;
    expect(runSimulation(strong).duplicateAdmissions).toBeGreaterThan(0);
    expect(
      totalCost({ ...repair, configuration: { ...repair.configuration, cache: 'ON_READS_ONLY' } }),
    ).toBe(83);
  });
  it('pure sources have no I/O, wall clock, RNG or evaluation', () => {
    const path = fileURLToPath(new URL('../../src/sim', import.meta.url));
    for (const f of readdirSync(path).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      expect(readFileSync(join(path, f), 'utf8')).not.toMatch(
        /\bDate\b|Math\.random|process\.|node:|\bfetch\b|\beval\s*\(|new Function/,
      );
    }
  });
  it('invalid/unsupported bundles reject safely; retry never repeats twice', () => {
    expect(() => runSimulation({})).toThrow('Invalid input');
    expect(() => runSimulation({ ...repair, engineVersion: 'bad' })).toThrow();
    const event = expandTraffic(repair)[0]![0]!;
    expect(retryFor({ ...event, retry: true }, repair)).toBeNull();
    expect(step(initialState(), [], repair).t).toBe(1);
  });
});
