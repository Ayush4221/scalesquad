import { describe, it, expect } from 'vitest';
import { fixture } from '../fakes';
import { gameControllers, type Context } from '../../../src/server/controllers/gameController';
import { createWsController } from '../../../src/server/controllers/wsController';
import { ClientEvent } from '@scalesquad/shared';
describe('thin game controllers', () => {
  it('controller contract: all actions validate, delegate and return public results', async () => {
    const f = fixture(),
      c = gameControllers(f.services),
      context: Context = { userId: 'a', name: 'Player a', matchId: '', body: {} };
    const v = await c.create(context);
    context.matchId = v.id;
    await c.join({ ...context, userId: 'b', body: { code: v.joinCode } });
    await c.join({ ...context, userId: 'c', body: { code: v.joinCode } });
    expect(await c.me(context)).toEqual({ userId: 'a', name: 'Player a' });
    expect((await c.view(context)).phase).toBe('LOBBY');
    for (const userId of ['a', 'b', 'c'])
      await c.ready({ ...context, userId, body: { ready: true } });
    await c.start(context);
    expect(await c.evidence(context)).toHaveLength(1);
    for (const userId of ['a', 'b', 'c']) await c.acknowledge({ ...context, userId });
    await c.update({
      ...context,
      body: { change: f.scenario.referenceRepair, expectedVersion: 0 },
    });
    expect((await c.config(context)).version).toBe(1);
    await c.pass({ ...context, body: { targetUserId: 'b' } });
    f.clock.value += f.scenario.match.lockLeaseMs;
    await c.reclaim(context);
    expect((await c.token({ ...context, body: { matchId: v.id } })).groupRef).toBe(v.id);
    await c.run({ ...context, body: { runNumber: 1 } });
    expect(await c.runs(context)).toHaveLength(2);
    await c.advance(context);
    const other = await c.create({ ...context, matchId: '' });
    await c.join({ ...context, userId: 'b', body: { code: other.joinCode } });
    await c.leave({ ...context, userId: 'b', matchId: other.id });
  });
  it('rejects forged fields, oversized code and unsupported run numbers', async () => {
    const f = fixture(),
      c = gameControllers(f.services),
      ctx: Context = { userId: 'a', name: 'A', matchId: 'missing', body: { userId: 'victim' } };
    for (const fn of [c.create, c.start, c.advance, c.leave, c.acknowledge, c.reclaim])
      await expect(fn(ctx)).rejects.toMatchObject({ code: 'VALIDATION' });
    for (const [fn, body] of [
      [c.join, { code: 'x'.repeat(100) }],
      [c.ready, { ready: 'true' }],
      [c.update, { change: { cacheAsAuthority: true }, expectedVersion: 0 }],
      [c.pass, { targetUserId: 'bad user' }],
      [c.run, { runNumber: 2 }],
      [c.token, { matchId: '../bad' }],
    ] as const)
      await expect(fn({ ...ctx, body })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('WebSocket event dispatcher covers every shared event through services', async () => {
    const f = fixture(),
      id = await f.repair(),
      dispatch = createWsController(f.services);
    const event = (type: string, payload: unknown) =>
      ClientEvent.parse({ v: 1, id: 'request', type, payload });
    await dispatch('a', event('ping', {}));
    expect(await dispatch('a', event('match.subscribe', { matchId: id }))).toHaveProperty('id', id);
    await dispatch(
      'a',
      event('config.update', { matchId: id, change: { atomicCheckin: true }, expectedVersion: 0 }),
    );
    await dispatch('a', event('lock.pass', { matchId: id, targetUserId: 'b' }));
    f.clock.value += f.scenario.match.lockLeaseMs;
    await dispatch('a', event('lock.reclaim', { matchId: id }));
    await dispatch('a', event('run.start', { matchId: id, runNumber: 1 }));
    await f.match.advance('a', id);
    for (const user of ['a', 'b', 'c']) await dispatch(user, event('brief.ack', { matchId: id }));
    const other = await f.match.createMatch('a');
    await dispatch('a', event('player.ready', { matchId: other.id, ready: true }));
  });
});
