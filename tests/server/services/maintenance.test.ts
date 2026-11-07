import { describe, it, expect, vi } from 'vitest';
import { fixture } from '../fakes';
import { MaintenanceService } from '../../../src/server/services/maintenanceService';
import { silentEvents } from '../../../src/server/domain/ports';
import { runtimePolicy } from '../../../src/server/constants/runtimePolicy';

describe('bounded match lifecycle and presence', () => {
  it('presence changes no aggregate revision and renews only the live holder lease', async () => {
    const f = fixture(),
      id = await f.repair();
    const before = (await f.repo.find(id))!;
    f.clock.value += 1000;
    await f.lock.presence('a', id, true);
    const after = (await f.repo.find(id))!;
    expect(after.revision).toBe(before.revision);
    expect(after.lock!.expiresAt).toBeGreaterThan(before.lock!.expiresAt);
    expect(after.members[0]!.lastSeenAt).toBe(f.clock.value);
    await f.lock.presence('b', id, false);
    expect((await f.repo.find(id))!.lock).toEqual(after.lock);
    await expect(f.lock.presence('outsider', id, true)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('caps concurrent creations before provisioning chat groups', async () => {
    const f = fixture();
    const result = await Promise.allSettled(
      Array.from({ length: 8 }, () => f.match.createMatch('a')),
    );
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(
      runtimePolicy.maxActiveMatchesPerHost,
    );
    expect(f.chat.groups.size).toBe(runtimePolicy.maxActiveMatchesPerHost);
  });
  it('daily cap remains after matches finish', async () => {
    const f = fixture();
    for (let i = 0; i < runtimePolicy.maxMatchesPerDay; i++) {
      const m = await f.match.createMatch('a');
      await f.repo.mutate(m.id, (m) => {
        m.phase = 'FINISHED';
      });
      await f.chat.deleteGroup(m.id);
      await f.repo.clearGroup(m.id, m.id);
    }
    await expect(f.match.createMatch('a')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    f.clock.value += 86400001;
    await expect(f.match.createMatch('a')).resolves.toBeDefined();
  });
  it('keeps quota reserved while a finished chat group still needs cleanup', async () => {
    const f = fixture();
    for (let i = 0; i < runtimePolicy.maxActiveMatchesPerHost; i++) {
      const m = await f.match.createMatch('a');
      await f.repo.mutate(m.id, (m) => {
        m.phase = 'FINISHED';
      });
    }
    await expect(f.match.createMatch('a')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await new MaintenanceService(f.repo, f.clock, silentEvents, f.chat).sweep();
    await expect(f.match.createMatch('a')).resolves.toBeDefined();
  });
  it('membership caps apply before group access but preserve idempotent joins', async () => {
    const f = fixture(),
      m = await f.match.createMatch('a');
    vi.spyOn(f.repo, 'countMemberships').mockResolvedValue(
      runtimePolicy.maxActiveMembershipsPerUser,
    );
    await expect(f.match.createMatch('b')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(f.match.joinMatch('b', m.joinCode!)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await expect(f.match.joinMatch('a', m.joinCode!)).resolves.toBeDefined();
    expect(f.chat.groups.get(m.id)?.size).toBe(1);
  });
  it('loads due IDs only; closes abandoned matches and retries group cleanup', async () => {
    const f = fixture(),
      changed = vi.fn();
    const m = await f.match.createMatch('a'),
      active = await f.match.createMatch('b');
    const maintenance = new MaintenanceService(
      f.repo,
      f.clock,
      { ...silentEvents, changed },
      f.chat,
    );
    await f.repo.mutate(m.id, (m) => {
      m.deadlineAt = f.clock.value;
    });
    expect(await maintenance.due()).toEqual([m.id]);
    f.clock.value += runtimePolicy.inactiveMatchMs + 1;
    await f.lock.presence('b', active.id, true);
    vi.spyOn(f.chat, 'deleteGroup').mockRejectedValueOnce(new Error('offline'));
    await maintenance.sweep();
    expect((await f.repo.find(m.id))!.phase).toBe('FINISHED');
    expect((await f.repo.find(active.id))!.phase).toBe('LOBBY');
    expect(changed).toHaveBeenCalledWith(m.id);
    expect(f.chat.groups.has(m.id)).toBe(true);
    await maintenance.sweep();
    expect(f.chat.groups.has(m.id)).toBe(false);
    expect((await f.repo.find(m.id))!.groupRef).toBeNull();
    expect(await f.repo.closeInactive(active.id, f.clock.value - 1, f.clock.value)).toBe(false);
  });
});
