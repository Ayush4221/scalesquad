import { describe, it, expect, vi } from 'vitest';
import { fixture } from '../fakes';
import { RunService } from '../../../src/server/services/runService';
import { silentEvents } from '../../../src/server/lib/ports';
import { contentHash } from '@scalesquad/shared';
import { runSimulation } from '@scalesquad/sim';
describe('missing records fail closed', () => {
  it('every member-scoped read/action rejects a missing match', async () => {
    const f = fixture();
    for (const fn of [
      () => f.match.getPublicView('a', 'missing'),
      () => f.evidence.get('a', 'missing'),
      () => f.config.get('a', 'missing'),
      () => f.run.get('a', 'missing'),
      () => f.run.start('a', 'missing', 1),
      () => f.match.chatToken('a', 'missing'),
      () => f.match.leaveMatch('a', 'missing'),
    ])
      await expect(fn()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.match.joinMatch(null, 'ABCDEFGH')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
  it('token endpoint refuses a disabled group and current config is required', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.repo.mutate(id, (m) => {
      m.groupRef = null;
    });
    await expect(f.match.chatToken('a', id)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    await f.repo.mutate(id, (m) => {
      m.configurations = [];
    });
    await expect(f.config.get('a', id)).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
describe('run authorization, crash recovery and input integrity', () => {
  it('rechecks editor authority when repairing a saved completion', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.run.start('a', id, 1);
    await f.repo.mutate(id, (m) => {
      m.phase = 'REPAIR_1';
      m.runError = true;
    });
    await f.lock.passControl('a', id, 'b');
    const find = f.repo.find.bind(f.repo);
    vi.spyOn(f.repo, 'find').mockImplementationOnce(async (matchId) => {
      const snapshot = await find(matchId);
      await f.lock.passControl('b', id, 'c');
      return snapshot;
    });
    await expect(f.run.start('b', id, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await f.repo.find(id))?.phase).toBe('REPAIR_1');
  });
  it('finishes saved results after a restart instead of stranding the match in repair', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.run.start('a', id, 1);
    await f.repo.mutate(id, (m) => {
      m.simulationLocked = true;
      m.deadlineAt = null;
    });
    await f.run.recover((await f.repo.find(id))!);
    expect(await f.repo.find(id)).toMatchObject({
      phase: 'RUNS_1_2',
      simulationLocked: false,
      runError: false,
    });
    await f.match.advance('a', id);
    for (const user of ['a', 'b', 'c']) await f.match.acknowledge(user, id);
    await f.run.start('a', id, 3);
    await f.repo.mutate(id, (m) => {
      m.phase = 'RUN_3';
      m.simulationLocked = true;
      m.deadlineAt = null;
    });
    await f.run.recover((await f.repo.find(id))!);
    const finished = (await f.repo.find(id))!;
    expect(finished).toMatchObject({ phase: 'COMPARE', simulationLocked: false, runError: false });
    expect(finished.deadlineAt).toBeGreaterThan(f.clock.now());
    expect(finished.runs).toHaveLength(3);
  });
  it('returns an unfinished crashed run to repair and permits retry of an older saved completion', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.repo.mutate(id, (m) => {
      m.phase = 'RUNS_1_2';
      m.simulationLocked = true;
    });
    await f.run.recover((await f.repo.find(id))!);
    expect(await f.repo.find(id)).toMatchObject({
      phase: 'REPAIR_1',
      simulationLocked: false,
      runError: true,
    });
    await f.run.start('a', id, 1);
    await f.repo.mutate(id, (m) => {
      m.phase = 'REPAIR_1';
      m.runError = true;
      m.deadlineAt = null;
    });
    await f.run.start('a', id, 1);
    expect(await f.repo.find(id)).toMatchObject({
      phase: 'RUNS_1_2',
      simulationLocked: false,
      runError: false,
    });
    expect((await f.repo.find(id))?.runs).toHaveLength(2);
  });
  it('keeps completed results when the first final-state save fails', async () => {
    const f = fixture(),
      id = await f.repair();
    const mutate = f.repo.mutate.bind(f.repo);
    let failed = false;
    vi.spyOn(f.repo, 'mutate').mockImplementation((matchId, fn) =>
      mutate(matchId, (m) => {
        const result = fn(m);
        if (!failed && m.phase === 'RUNS_1_2' && !m.simulationLocked && m.runs.length === 2) {
          failed = true;
          throw new Error('Save interrupted');
        }
        return result;
      }),
    );
    await f.run.start('a', id, 1);
    expect(failed).toBe(true);
    expect(await f.repo.find(id)).toMatchObject({
      phase: 'RUNS_1_2',
      simulationLocked: false,
      runError: false,
    });
    expect((await f.repo.find(id))?.runs).toHaveLength(2);
  });
  it('does not treat a repair request as a duplicate of a running baseline', async () => {
    const f = fixture(),
      id = await f.repair();
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = new RunService(f.repo, f.clock, silentEvents, async (bundle) => {
      entered();
      await pending;
      return runSimulation(bundle);
    });
    const baseline = run.start('a', id, 1);
    await started;
    try {
      await expect(run.start('a', id, 3)).rejects.toMatchObject({ code: 'PHASE_INVALID' });
    } finally {
      release();
    }
    await baseline;
    expect((await f.repo.find(id))?.runs.map((r) => r.runNumber)).toEqual([1, 2]);
  });
  it('only host or editor can start, and wrong phase/locked/missing baseline reject', async () => {
    const f = fixture(),
      id = await f.repair();
    await expect(f.run.start('b', id, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await f.repo.mutate(id, (m) => {
      m.simulationLocked = true;
    });
    await expect(f.run.start('a', id, 1)).rejects.toMatchObject({ code: 'CONFLICT' });
    await f.repo.mutate(id, (m) => {
      m.simulationLocked = false;
      m.phase = 'REPAIR_2';
    });
    await expect(f.run.start('a', id, 1)).rejects.toMatchObject({ code: 'PHASE_INVALID' });
    await expect(f.run.start('a', id, 3)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('the editor can start and a partial failure safely resumes without duplicate rows', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.lock.passControl('a', id, 'b');
    const execute = vi
      .fn()
      .mockImplementationOnce(async (b) => runSimulation(b))
      .mockRejectedValueOnce(new Error('interrupted'))
      .mockImplementation(async (b) => runSimulation(b));
    const run = new RunService(f.repo, f.clock, silentEvents, execute);
    await expect(run.start('b', id, 1)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect((await f.repo.find(id))?.runs).toHaveLength(1);
    await run.start('b', id, 1);
    expect((await f.repo.find(id))?.runs).toHaveLength(2);
    await run.recover((await f.repo.find(id))!);
    await f.repo.mutate(id, (m) => {
      m.phase = 'RUNS_1_2';
      m.simulationLocked = true;
    });
    await run.recover((await f.repo.find(id))!);
    expect((await f.repo.find(id))?.phase).toBe('RUNS_1_2');
  });
  it('a worker with the wrong result hash cannot save a run', async () => {
    const f = fixture(),
      id = await f.repair(),
      run = new RunService(f.repo, f.clock, silentEvents, async (b) => ({
        ...runSimulation(b),
        inputHash: '0'.repeat(64),
      }));
    await expect(run.start('a', id, 1)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect((await f.repo.find(id))?.runs).toHaveLength(0);
  });
  it('both stored hash mismatch and altered shared inputs block the repaired run', async () => {
    for (const shared of [false, true]) {
      const f = fixture(),
        id = await f.repair();
      await f.run.start('a', id, 1);
      await f.match.advance('a', id);
      for (const u of ['a', 'b', 'c']) await f.match.acknowledge(u, id);
      await f.repo.mutate(id, (m) => {
        const second = m.runs.find((r) => r.runNumber === 2)!;
        if (shared) {
          const bundle = second.input as {
            scenario: { profiles: { incident: { version: string } } };
          };
          bundle.scenario.profiles.incident.version = 'tampered';
          second.result.inputHash = contentHash(bundle);
        } else second.result.inputHash = '0'.repeat(64);
      });
      await expect(f.run.start('a', id, 3)).rejects.toMatchObject({
        code: 'COMPARISON_INPUT_MISMATCH',
      });
    }
  });
});
