import { JOIN_ALPHABET } from '../../../src/constants/joinCode';
import { describe, it, expect, vi } from 'vitest';
import { MatchPhase, Role, AppError, contentHash } from '@scalesquad/shared';
import { fixture } from '../fakes';
import { canTransition } from '../../../src/server/services/matchStateMachine';
import { assignRoles } from '../../../src/server/services/roles';
import {
  generateJoinCode,
  normalizeCode,
  uniqueJoinCode,
} from '../../../src/server/utils/joinCode';
import { RunService } from '../../../src/server/services/runService';
import { silentEvents } from '../../../src/server/lib/ports';
import { runSimulation } from '@scalesquad/sim';
describe('server-owned match state machine', () => {
  const members = Role.options.map((role, i) => ({
    userId: String(i),
    name: 'Player',
    role,
    ready: true,
    acknowledged: true,
    lastSeenAt: 0,
    disconnectedAt: null,
  }));
  const phases = MatchPhase.options;
  for (const [i, from] of phases.entries())
    for (const [j, to] of phases.entries())
      it(`${from} → ${to}`, () => {
        expect(canTransition(from, to, { members })).toBe(j === i + 1);
      });
  it('requires all roles ready and all briefs read unless timer elapsed', () => {
    expect(canTransition('LOBBY', 'BRIEFING', { members: members.slice(0, 2) })).toBe(false);
    expect(
      canTransition('LOBBY', 'BRIEFING', { members: members.map((m) => ({ ...m, ready: false })) }),
    ).toBe(false);
    expect(
      canTransition('BRIEFING', 'REPAIR_1', {
        members: members.map((m) => ({ ...m, acknowledged: false })),
      }),
    ).toBe(false);
    expect(canTransition('BRIEFING', 'REPAIR_1', { members: [], timerElapsed: true })).toBe(true);
  });
});
describe('join code and roles', () => {
  it('codes use an unambiguous alphabet, normalize and bound collision retries', async () => {
    const code = generateJoinCode(() => 3);
    expect(code).toHaveLength(8);
    expect([...code].every((c) => JOIN_ALPHABET.includes(c))).toBe(true);
    expect(normalizeCode(' abcd2345 ')).toBe('ABCD2345');
    expect(new Set(assignRoles('a')).size).toBe(3);
    expect(assignRoles('a')).toEqual(assignRoles('a'));
    expect(assignRoles('b')).not.toEqual(assignRoles('a'));
    await expect(
      uniqueJoinCode(
        async () => true,
        () => code,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      uniqueJoinCode(
        async () => false,
        () => code,
      ),
    ).resolves.toBe(code);
  });
});
describe('lobby and authorization', () => {
  it('waits for chat provisioning before starting, then rejects a failed join', async () => {
    const f = fixture();
    const view = await f.match.createMatch('a');
    await f.match.joinMatch('b', view.joinCode!);
    for (const user of ['a', 'b']) await f.match.setReady(user, view.id, true);
    let release!: () => void;
    let entered!: () => void;
    const enteredChat = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pendingChat = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(f.chat, 'addMember').mockImplementationOnce(async () => {
      await f.match.setReady('c', view.id, true);
      entered();
      await pendingChat;
      throw new AppError('UPSTREAM_UNAVAILABLE', 503);
    });
    const joinResult = f.match.joinMatch('c', view.joinCode!).catch((error: unknown) => error);
    await enteredChat;
    const startResult = f.match.startMatch('a', view.id).catch((error: unknown) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect((await f.repo.find(view.id))?.phase).toBe('LOBBY');
    release();
    expect(await joinResult).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(await startResult).toMatchObject({ code: 'PHASE_INVALID' });
    expect((await f.repo.find(view.id))?.members.map((m) => m.userId)).toEqual(['a', 'b']);
  });
  it('finishes a pending leave before evaluating whether the squad can start', async () => {
    const f = fixture(),
      id = await f.lobby();
    for (const user of ['a', 'b', 'c']) await f.match.setReady(user, id, true);
    let release!: () => void;
    let entered!: () => void;
    const enteredChat = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pendingChat = new Promise<void>((resolve) => {
      release = resolve;
    });
    const remove = f.chat.removeMember.bind(f.chat);
    vi.spyOn(f.chat, 'removeMember').mockImplementationOnce(async (...args) => {
      entered();
      await pendingChat;
      await remove(...args);
    });
    const leaving = f.match.leaveMatch('c', id);
    await enteredChat;
    const startResult = f.match.startMatch('a', id).catch((error: unknown) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect((await f.repo.find(id))?.phase).toBe('LOBBY');
    release();
    await leaving;
    expect(await startResult).toMatchObject({ code: 'PHASE_INVALID' });
    expect((await f.repo.find(id))?.members).toHaveLength(2);
    expect(f.chat.groups.get(id)?.has('c')).toBe(false);
  });
  it('create/join idempotency, role privacy, ready and start guards', async () => {
    const f = fixture();
    await expect(f.match.createMatch(null)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(f.match.createMatch('missing')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const v = await f.match.createMatch('a');
    expect(v.ownRole).toBeNull();
    expect(JSON.stringify(v)).not.toContain('"role"');
    expect(f.chat.groups.size).toBe(1);
    await expect(f.match.startMatch('a', v.id)).rejects.toMatchObject({ code: 'PHASE_INVALID' });
    await f.match.joinMatch('b', ` ${v.joinCode!.toLowerCase()} `);
    await f.match.joinMatch('b', v.joinCode!);
    await f.match.joinMatch('c', v.joinCode!);
    await expect(f.match.joinMatch('d', v.joinCode!)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(f.match.startMatch('b', v.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    for (const u of ['a', 'b', 'c']) await f.match.setReady(u, v.id, true);
    await f.match.startMatch('a', v.id);
    expect((await f.match.getPublicView('b', v.id)).ownRole).not.toBeNull();
    expect((await f.repo.find(v.id))?.audit.map((a) => a.action)).toContain('match.start');
    await expect(f.match.joinMatch('d', v.joinCode!)).rejects.toMatchObject({
      code: 'PHASE_INVALID',
    });
  });
  it('rejects invalid/expired codes and unknown users; leave removes group membership', async () => {
    const f = fixture(),
      v = await f.match.createMatch('a');
    await expect(f.match.joinMatch('b', 'BAD')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.match.joinMatch('missing', v.joinCode!)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await f.match.joinMatch('b', v.joinCode!);
    await f.match.leaveMatch('b', v.id);
    expect(f.chat.groups.get(v.id)?.has('b')).toBe(false);
    await expect(f.match.leaveMatch('a', v.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    f.clock.value += f.scenario.match.joinCodeTtlMs;
    await expect(f.match.joinMatch('c', v.joinCode!)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('provider failure leaves no orphan and DB failure cleans provider group', async () => {
    const f = fixture();
    vi.spyOn(f.chat, 'createGroup').mockRejectedValue(new AppError('UPSTREAM_UNAVAILABLE', 503));
    await expect(f.match.createMatch('a')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(f.repo.data.size).toBe(0);
    const other = fixture();
    vi.spyOn(other.repo, 'create').mockRejectedValue(new Error('DB unavailable'));
    await expect(other.match.createMatch('a')).rejects.toThrow();
    expect(other.chat.groups.size).toBe(0);
  });
  it('join provider failure rolls back membership; tokens are own-user only', async () => {
    const f = fixture(),
      v = await f.match.createMatch('a');
    vi.spyOn(f.chat, 'addMember').mockRejectedValue(new AppError('UPSTREAM_UNAVAILABLE', 503));
    await expect(f.match.joinMatch('b', v.joinCode!)).rejects.toThrow();
    expect((await f.repo.find(v.id))?.members).toHaveLength(1);
    await expect(f.match.chatToken('b', v.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await f.match.chatToken('a', v.id)).token).toBe('test-a');
  });
  it('revokes a join that succeeded upstream before its response failed', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    const add = f.chat.addMember.bind(f.chat);
    vi.spyOn(f.chat, 'addMember').mockImplementationOnce(async (...args) => {
      await add(...args);
      throw new AppError('UPSTREAM_UNAVAILABLE', 503);
    });
    await expect(f.match.joinMatch('b', view.joinCode!)).rejects.toThrow();
    expect(f.chat.groups.get(view.id)?.has('b')).toBe(false);
    expect((await f.repo.find(view.id))?.members).toHaveLength(1);
  });
  it('retains a failed cleanup reservation and can repair it with a join retry', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    vi.spyOn(f.chat, 'addMember').mockRejectedValueOnce(new AppError('UPSTREAM_UNAVAILABLE', 503));
    vi.spyOn(f.chat, 'removeMember').mockRejectedValueOnce(
      new AppError('UPSTREAM_UNAVAILABLE', 503),
    );
    await expect(f.match.joinMatch('b', view.joinCode!)).rejects.toThrow();
    expect((await f.repo.find(view.id))?.members.find((m) => m.userId === 'b')?.ready).toBe(false);
    await f.match.joinMatch('b', view.joinCode!);
    expect(f.chat.groups.get(view.id)?.has('b')).toBe(true);
    expect((await f.repo.find(view.id))?.members).toHaveLength(2);
  });
  it('restores chat membership if saving a leave fails', async () => {
    const f = fixture(),
      id = await f.lobby();
    vi.spyOn(f.repo, 'mutate').mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(f.match.leaveMatch('b', id)).rejects.toThrow('Database unavailable');
    expect((await f.repo.find(id))?.members).toHaveLength(3);
    expect(f.chat.groups.get(id)?.has('b')).toBe(true);
  });
  it('timers persist and recover briefing and incident deadlines', async () => {
    const f = fixture(),
      id = await f.briefing();
    await f.match.expire(id);
    expect((await f.repo.find(id))?.phase).toBe('BRIEFING');
    f.clock.value += f.scenario.match.briefDurationMs;
    await f.match.expire(id);
    expect((await f.repo.find(id))?.phase).toBe('REPAIR_1');
    await f.run.start('a', id, 1);
    await f.match.advance('a', id);
    f.clock.value += f.scenario.match.incidentDurationMs;
    await f.match.expire(id);
    expect((await f.repo.find(id))?.phase).toBe('REPAIR_2');
  });
});
describe('configuration and edit lock', () => {
  it('increments once; concurrent expected-version writes have a single winner', async () => {
    const f = fixture(),
      id = await f.repair();
    const r = await Promise.allSettled([
      f.config.update('a', id, { atomicCheckin: true }, 0),
      f.config.update('a', id, { cache: 'ON_READS_ONLY' }, 0),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect((await f.config.get('b', id)).version).toBe(1);
    await expect(f.config.update('a', id, { cacheAsAuthority: true }, 1)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(f.config.update('a', id, { appCapacity: 'MAX' }, 1)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
  it('holder-only pass, disconnect timeout, reconnect cancellation and expiry reclaim', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.lock.passControl('a', id, 'b');
    await expect(f.config.update('a', id, { atomicCheckin: true }, 0)).rejects.toMatchObject({
      code: 'LOCK_NOT_HELD',
    });
    await expect(f.lock.passControl('a', id, 'c')).rejects.toMatchObject({ code: 'LOCK_NOT_HELD' });
    await expect(f.lock.passControl('b', id, 'd')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.lock.reclaim('b', id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.lock.reclaim('a', id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await f.lock.presence('b', id, false);
    f.clock.value += 100;
    await expect(f.lock.reclaim('a', id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await f.lock.presence('b', id, true);
    f.clock.value += f.scenario.match.reclaimAfterMs;
    await expect(f.lock.reclaim('a', id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await f.lock.presence('b', id, false);
    f.clock.value += f.scenario.match.reclaimAfterMs;
    await f.lock.reclaim('a', id);
    expect((await f.repo.find(id))?.lock?.holderUserId).toBe('a');
    f.clock.value += f.scenario.match.lockLeaseMs;
    await expect(f.config.update('a', id, { atomicCheckin: true }, 0)).rejects.toMatchObject({
      code: 'LOCK_NOT_HELD',
    });
    await f.lock.reclaim('a', id);
    await f.lock.passControl('a', id, 'a');
  });
  it('rejects edits in wrong phase or while simulation locked', async () => {
    const f = fixture(),
      id = await f.lobby();
    await expect(f.config.update('a', id, { atomicCheckin: true }, 0)).rejects.toMatchObject({
      code: 'PHASE_INVALID',
    });
    await f.repo.mutate(id, (m) => {
      m.phase = 'REPAIR_1';
      m.simulationLocked = true;
    });
    await expect(f.config.update('a', id, { atomicCheckin: true }, 0)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(f.lock.reclaim('a', id)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
describe('three-run match orchestration', () => {
  it('full three-player match; original preset preserved, edited repair used only in Run 3', async () => {
    const changed = vi.fn(),
      privateNotice = vi.fn(),
      completed = vi.fn();
    const f = fixture({
      ...silentEvents,
      changed,
      evidenceAvailable: privateNotice,
      runCompleted: completed,
    });
    const id = await f.repair();
    await f.config.update('a', id, f.scenario.referenceRepair, 0);
    await Promise.all([f.run.start('a', id, 1), f.run.start('a', id, 1)]);
    let m = (await f.repo.find(id))!;
    expect(m.runs).toHaveLength(2);
    expect(m.simulationLocked).toBe(false);
    expect(m.phase).toBe('RUNS_1_2');
    expect(m.runs[0]?.snapshotHash).toBe(contentHash(f.scenario.presetConfiguration));
    expect(m.runs[1]?.snapshotHash).toBe(m.runs[0]?.snapshotHash);
    await f.run.start('a', id, 1);
    expect((await f.repo.find(id))?.runs).toHaveLength(2);
    await f.match.advance('a', id);
    expect((await f.repo.find(id))?.phase).toBe('INCIDENT_EVIDENCE');
    for (const u of ['a', 'b', 'c']) await f.match.acknowledge(u, id);
    expect((await f.config.get('b', id)).values).toEqual(f.scenario.referenceRepair);
    await f.run.start('a', id, 3);
    m = (await f.repo.find(id))!;
    expect(m.phase).toBe('COMPARE');
    expect(m.runs[2]?.result.overallGatePassed).toBe(true);
    expect(m.runs[1]?.result.sharedInputHash).toBe(m.runs[2]?.result.sharedInputHash);
    expect((await f.match.getPublicView('b', id)).comparison?.status).toBe('PASSED');
    await f.match.advance('a', id);
    expect((await f.repo.find(id))?.phase).toBe('FINISHED');
    expect(privateNotice).toHaveBeenCalledTimes(6);
    expect(completed).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(f.chat.notices)).not.toContain('peak');
  });
  it('simulation error unlocks safely and permits retry', async () => {
    const f = fixture(),
      id = await f.repair();
    const executor = vi
      .fn()
      .mockRejectedValueOnce(new Error('secret internal'))
      .mockImplementation(async (b) => runSimulation(b));
    const service = new RunService(f.repo, f.clock, silentEvents, executor);
    await expect(service.start('a', id, 1)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect((await f.repo.find(id))?.simulationLocked).toBe(false);
    expect((await f.repo.find(id))?.runError).toBe(true);
    await service.start('a', id, 1);
    expect((await f.repo.find(id))?.runs).toHaveLength(2);
  });
  it('detects persisted input tampering before run 3', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.run.start('a', id, 1);
    await f.match.advance('a', id);
    for (const u of ['a', 'b', 'c']) await f.match.acknowledge(u, id);
    await f.repo.mutate(id, (m) => {
      const r = m.runs.find((r) => r.runNumber === 2)!;
      r.input = {};
    });
    await expect(f.run.start('a', id, 3)).rejects.toThrow();
  });
  it('restart recovers a persisted simulation lock', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.repo.mutate(id, (m) => {
      m.phase = 'RUN_3';
      m.simulationLocked = true;
    });
    await f.run.recover((await f.repo.find(id))!);
    expect((await f.repo.find(id))?.phase).toBe('REPAIR_2');
  });
});
describe('service authorization matrix', () => {
  const methods = [
    'view',
    'ready',
    'start',
    'advance',
    'leave',
    'ack',
    'evidence',
    'config',
    'update',
    'pass',
    'reclaim',
    'runs',
    'run',
    'token',
  ] as const;
  for (const method of methods)
    for (const user of [null, 'd'])
      it(`${method}: rejects ${user === null ? 'unauthenticated' : 'non-member'}`, async () => {
        const f = fixture(),
          id = await f.repair();
        const calls = {
          view: () => f.match.getPublicView(user, id),
          ready: () => f.match.setReady(user, id, true),
          start: () => f.match.startMatch(user, id),
          advance: () => f.match.advance(user, id),
          leave: () => f.match.leaveMatch(user, id),
          ack: () => f.match.acknowledge(user, id),
          evidence: () => f.evidence.get(user, id),
          config: () => f.config.get(user, id),
          update: () => f.config.update(user, id, { atomicCheckin: true }, 0),
          pass: () => f.lock.passControl(user, id, 'b'),
          reclaim: () => f.lock.reclaim(user, id),
          runs: () => f.run.get(user, id),
          run: () => f.run.start(user, id, 1),
          token: () => f.match.chatToken(user, id),
        };
        await expect(calls[method]()).rejects.toMatchObject({
          code: user === null ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        });
      });
});
