import { describe, expect, it } from 'vitest';
import { checkin, emptyPassStore } from '../../src/sim/checkin';
import { advanceQueue } from '../../src/sim/queue';
import { overloadPenalty, percentile } from '../../src/sim/latency';
import { loadScenario } from '@scalesquad/scenario';

describe('single-use pass rules', () => {
  it('atomic ON admits once; ALREADY_USED is a valid rejection', () => {
    const first = checkin(emptyPassStore(), {
      passId: 'P',
      requestId: 'a',
      gateId: 'A',
      readMs: 0,
      commitMs: 20,
      atomic: true,
      raceWindowMs: 20,
    });
    const second = checkin(first.store, {
      passId: 'P',
      requestId: 'b',
      gateId: 'B',
      readMs: 0,
      commitMs: 20,
      atomic: true,
      raceWindowMs: 20,
    });
    expect([first.outcome, second.outcome, second.duplicate]).toEqual([
      'ACCEPTED',
      'ALREADY_USED',
      false,
    ]);
  });
  it('non-atomic overlap is real: 3-way race gives 2 duplicates; no overlap rejects', () => {
    let store = emptyPassStore();
    let duplicates = 0;
    for (const requestId of ['a', 'b', 'c']) {
      const r = checkin(store, {
        passId: 'P',
        requestId,
        gateId: requestId,
        readMs: 0,
        commitMs: 20,
        atomic: false,
        raceWindowMs: 20,
      });
      store = r.store;
      duplicates += Number(r.duplicate);
    }
    expect(duplicates).toBe(2);
    expect(
      checkin(store, {
        passId: 'P',
        requestId: 'd',
        gateId: 'D',
        readMs: 21,
        commitMs: 40,
        atomic: false,
        raceWindowMs: 20,
      }).outcome,
    ).toBe('ALREADY_USED');
    expect(store.P?.state).toBe('ACCEPTED');
  });
});
describe('queue and latency rules', () => {
  it('uses max(0, backlog + arrivals - workers), rejects only excess backlog', () => {
    expect(advanceQueue(0, 5, 10, 100)).toEqual({
      backlog: 0,
      rejected: 0,
      processed: 5,
      waitSeconds: 0,
    });
    expect(advanceQueue(10, 20, 5, 20)).toEqual({
      backlog: 20,
      rejected: 5,
      processed: 5,
      waitSeconds: 2,
    });
  });
  it('overload penalty is zero below .7, monotonic and bounded', () => {
    const s = loadScenario();
    const vals = [0, 0.7, 0.8, 0.9, 1, 2, 100].map((u) => overloadPenalty(u, s.latency));
    expect(vals.slice(0, 2)).toEqual([0, 0]);
    expect(vals).toEqual([...vals].sort((a, b) => a - b));
    expect(vals.at(-1)).toBe(s.latency.maxPenaltyMs);
  });
  it('nearest-rank percentiles include ties, singleton and empty', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([5], 0.5)).toBe(5);
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
    expect(percentile([4, 1, 3, 2], 0.95)).toBe(4);
  });
});
