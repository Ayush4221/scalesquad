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
    expect((await f.repo.find(id))?.phase).toBe('REPAIR_1');
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
