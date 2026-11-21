import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@scalesquad/shared';
import { fixture } from '../fakes';
import { MatchService } from '../../../src/server/services/matchService';
import { ChatReconciliationService } from '../../../src/server/services/chatReconciliationService';
import { MaintenanceService } from '../../../src/server/services/maintenanceService';
import { silentEvents } from '../../../src/server/domain/ports';
import { KeyedQueue } from '../../../src/server/utils/keyedQueue';
import { runtimePolicy } from '../../../src/server/constants/runtimePolicy';
import { DisabledChatProvider } from '@scalesquad/nexconn/fake';

describe('durable chat compensation', () => {
  it('keeps cleanup after failed provisioning and retries it after service restart', async () => {
    const f = fixture();
    vi.spyOn(f.repo, 'create').mockRejectedValueOnce(new Error('DB interrupted'));
    vi.spyOn(f.chat, 'deleteGroup').mockRejectedValueOnce(new Error('provider offline'));
    await expect(f.match.createMatch('a')).rejects.toThrow('DB interrupted');
    expect(f.chat.groups.size).toBe(1);
    expect(f.repo.chatTasks.size).toBe(1);
    const restarted = new MatchService(
      f.repo,
      f.users,
      f.chat,
      f.clock,
      silentEvents,
      () => 'other',
    );
    await new MaintenanceService(f.repo, f.clock, silentEvents, f.chat, () =>
      restarted.reconcileChat(),
    ).sweep();
    expect(f.repo.chatTasks.size).toBe(0);
    expect(f.chat.groups.size).toBe(0);
  });
  it('records the group reference before a provisioning response can be lost', async () => {
    const f = fixture(),
      create = f.chat.createGroup.bind(f.chat);
    vi.spyOn(f.chat, 'createGroup').mockImplementationOnce(async (...args) => {
      expect(f.repo.chatTasks.size).toBe(1);
      await create(...args);
      throw new Error('response lost');
    });
    vi.spyOn(f.chat, 'deleteGroup').mockRejectedValueOnce(new Error('offline'));
    await expect(f.match.createMatch('a')).rejects.toThrow('response lost');
    await f.match.reconcileChat();
    expect(f.chat.groups.size).toBe(0);
    expect(f.repo.chatTasks.size).toBe(0);
  });
  it('never provisions when the durable intent cannot be saved', async () => {
    const f = fixture(),
      create = vi.spyOn(f.chat, 'createGroup');
    vi.spyOn(f.repo, 'saveChatTask').mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(f.match.createMatch('a')).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it('keeps an ambiguously committed group and clears a stranded completion record', async () => {
    const f = fixture(),
      create = f.repo.create.bind(f.repo);
    vi.spyOn(f.repo, 'create').mockImplementationOnce(async (match) => {
      await create(match);
      throw new Error('response lost');
    });
    await expect(f.match.createMatch('a')).resolves.toMatchObject({ id: 'match1' });
    expect(f.chat.groups.has('match1')).toBe(true);
    expect((await f.repo.find('match1'))?.groupRef).toBe('match1');
    const other = fixture();
    vi.spyOn(other.repo, 'completeChatTask').mockRejectedValueOnce(new Error('interrupted'));
    const view = await other.match.createMatch('a');
    expect(other.repo.chatTasks.size).toBe(1);
    await other.match.reconcileChat();
    expect(other.repo.chatTasks.size).toBe(0);
    expect(other.chat.groups.has(view.id)).toBe(true);
  });
  it('does not make a failed join reservation ready until chat membership is repaired', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    const add = vi
      .spyOn(f.chat, 'addMember')
      .mockRejectedValue(new AppError('UPSTREAM_UNAVAILABLE', 503));
    vi.spyOn(f.chat, 'removeMember').mockRejectedValueOnce(new Error('uncertain removal'));
    await expect(f.match.joinMatch('b', view.joinCode!)).rejects.toThrow();
    await expect(f.match.setReady('b', view.id, true)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    expect((await f.repo.find(view.id))?.members.find((user) => user.userId === 'b')?.ready).toBe(
      false,
    );
    add.mockRestore();
    await f.match.setReady('b', view.id, true);
    expect(f.chat.groups.get(view.id)?.has('b')).toBe(true);
    expect(f.repo.chatTasks.size).toBe(0);
    await expect(f.match.setReady('outsider', view.id, true)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('repairs a failed leave rollback without losing the local reservation', async () => {
    const f = fixture(),
      id = await f.lobby();
    vi.spyOn(f.repo, 'mutate').mockRejectedValueOnce(new Error('DB write failed'));
    vi.spyOn(f.chat, 'addMember').mockRejectedValueOnce(new Error('rollback failed'));
    await expect(f.match.leaveMatch('b', id)).rejects.toThrow('DB write failed');
    expect(f.chat.groups.get(id)?.has('b')).toBe(false);
    expect(f.repo.chatTasks.size).toBe(1);
    await f.match.reconcileChat();
    expect(f.chat.groups.get(id)?.has('b')).toBe(true);
    expect(f.repo.chatTasks.size).toBe(0);
  });
  it('reports a leave as successful when the database confirms its lost commit response', async () => {
    const f = fixture(),
      id = await f.lobby(),
      mutate = f.repo.mutate.bind(f.repo);
    vi.spyOn(f.repo, 'mutate').mockImplementationOnce(async (matchId, change) => {
      await mutate(matchId, change);
      throw new Error('commit response lost');
    });
    await expect(f.match.leaveMatch('b', id)).resolves.toBeUndefined();
    expect((await f.repo.find(id))?.members.some((member) => member.userId === 'b')).toBe(false);
    expect(f.chat.groups.get(id)?.has('b')).toBe(false);
  });
  it('removes a departed member from a stranded journal and ignores stale versions', async () => {
    const f = fixture(),
      id = await f.lobby();
    const state = new ChatReconciliationService(f.repo, f.chat, f.clock, new KeyedQueue());
    const old = await state.record(id, id, 'b');
    const current = await state.record(id, id, 'b');
    await state.settle(old);
    expect((await f.repo.findChatTask(old.id))?.version).toBe(current.version);
    await f.repo.mutate(id, (match) => {
      match.members = match.members.filter((user) => user.userId !== 'b');
    });
    await state.sweep();
    expect(f.chat.groups.get(id)?.has('b')).toBe(false);
    expect(f.repo.chatTasks.size).toBe(0);
  });
  it('defers failed tasks so the bounded sweep can reach other work', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    const state = new ChatReconciliationService(f.repo, f.chat, f.clock, new KeyedQueue());
    const task = await state.record(view.id, view.id, 'a');
    vi.spyOn(f.chat, 'addMember').mockRejectedValueOnce(new Error('offline'));
    await state.sweep();
    expect((await f.repo.findChatTask(task.id))?.retryAt).toBe(
      f.clock.now() + runtimePolicy.chatReconciliationRetryMs,
    );
    expect(await f.repo.pendingChatTasks(f.clock.now(), 100)).toEqual([]);
    f.clock.value += runtimePolicy.chatReconciliationRetryMs;
    await state.sweep();
    expect(f.repo.chatTasks.size).toBe(0);
  });
  it('cleans finished groups, preserves tasks when disabled, and checks newer task ownership', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    const state = new ChatReconciliationService(f.repo, f.chat, f.clock, new KeyedQueue());
    await state.record(view.id, view.id, null);
    await new ChatReconciliationService(
      f.repo,
      new DisabledChatProvider(),
      f.clock,
      new KeyedQueue(),
    ).sweep();
    expect(f.repo.chatTasks.size).toBe(1);
    await f.repo.mutate(view.id, (match) => {
      match.phase = 'FINISHED';
    });
    await state.sweep();
    expect((await f.repo.find(view.id))?.groupRef).toBeNull();
    expect(f.repo.chatTasks.size).toBe(0);
  });
});
