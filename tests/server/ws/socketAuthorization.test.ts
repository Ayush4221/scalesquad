import { describe, expect, it, vi } from 'vitest';
import { SessionService } from '../../../src/server/services/sessionService';
import { fixture } from '../fakes';
import type { SessionRepository } from '../../../src/server/domain/models';
import { deferred } from '../../helpers/deferred';

describe('socket authorization and batched projections', () => {
  it('waits for an in-flight forced revocation check instead of using the fresh cache', async () => {
    const pending = deferred<Awaited<ReturnType<SessionRepository['find']>>>();
    const find = vi
      .fn<SessionRepository['find']>()
      .mockResolvedValueOnce({ userId: 'a', name: 'A', expires: 10000 })
      .mockReturnValueOnce(pending.promise);
    const connection = (await new SessionService({ find }, { now: () => 1000 }).openSocket(
      'authjs.session-token=token',
    ))!;
    const forced = connection.authorize(true);
    let finished = false;
    const outbound = connection.authorize().then((value) => {
      finished = true;
      return value;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    pending.resolve(null);
    expect(await forced).toBe(false);
    expect(await outbound).toBe(false);
    expect(find).toHaveBeenCalledTimes(2);
  });
  it('reuses outbound authorization and forces fresh checks for inbound revocation', async () => {
    const clock = {
      value: 1000,
      now() {
        return this.value;
      },
    };
    const find = vi.fn(
      async (_token: string) =>
        ({ userId: 'a', name: 'A', expires: 10000 }) as {
          userId: string;
          name: string;
          expires: number;
        } | null,
    );
    const connection = (await new SessionService({ find }, clock).openSocket(
      'authjs.session-token=token',
    ))!;
    for (let i = 0; i < 20; i++) expect(await connection.authorize()).toBe(true);
    expect(find).toHaveBeenCalledTimes(1);
    clock.value = 6000;
    expect(await connection.authorize()).toBe(true);
    expect(find).toHaveBeenCalledTimes(2);
    find.mockResolvedValue(null);
    expect(await connection.authorize(true)).toBe(false);
    expect(await connection.authorize()).toBe(false);
    expect(find).toHaveBeenCalledTimes(3);
  });
  it('rejects known expiry even while the outbound cache is fresh', async () => {
    const clock = {
      value: 1000,
      now() {
        return this.value;
      },
    };
    const find = vi.fn(async () => ({ userId: 'a', name: 'A', expires: 1500 }));
    const connection = (await new SessionService({ find }, clock).openSocket(
      'authjs.session-token=token',
    ))!;
    clock.value = 1500;
    expect(await connection.authorize()).toBe(false);
    expect(find).toHaveBeenCalledTimes(1);
  });
  it('keeps a confirmed session through a transient database failure, then retries', async () => {
    const find = vi.fn<SessionRepository['find']>(async () => ({
      userId: 'a',
      name: 'A',
      expires: 10000,
    }));
    const connection = (await new SessionService({ find }, { now: () => 1000 }).openSocket(
      'authjs.session-token=token',
    ))!;
    find.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await connection.authorize(true)).toBe(true);
    expect(await connection.authorize(true)).toBe(true);
    expect(find).toHaveBeenCalledTimes(3);
    find.mockResolvedValueOnce(null);
    expect(await connection.authorize(true)).toBe(false);
    expect(await connection.authorize()).toBe(false);
  });
  it('loads one graph for personalized snapshots and excludes nonmembers', async () => {
    const f = fixture();
    const id = await f.repair();
    const find = vi.spyOn(f.repo, 'find');
    const views = await f.match.getPublicViews(['a', 'b', 'c', 'outsider', 'a'], id);
    expect(find).toHaveBeenCalledTimes(1);
    expect(views.size).toBe(3);
    expect(views.has('outsider')).toBe(false);
    const record = (await f.repo.find(id))!;
    for (const user of record.members) {
      const view = views.get(user.userId)!;
      expect(view.ownRole).toBe(user.role);
      expect(view).not.toHaveProperty('evidence');
      expect(view.members.find((member) => member.userId === user.userId)?.role).toBe(user.role);
    }
  });
});
