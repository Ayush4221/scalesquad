import { describe, it, expect, vi } from 'vitest';
import { NexconnChatProvider, chatUserId } from '../../src/nexconn/provider';
import { DisabledChatProvider, FakeChatProvider } from '../../src/nexconn/fake';
describe('documented Nexconn server contract', () => {
  it('signs JSON, never exposes secret, server owns and controls group access', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const request: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({ code: 0, result: { accessToken: 'test-only-token', userId: 'user' } });
    };
    const p = new NexconnChatProvider('test-app-key', 'test-app-secret', 'SG', request);
    const group = await p.createGroup('match', ['a']);
    await p.addMember(group, 'b');
    await p.removeMember(group, 'b');
    const token = await p.mintUserToken('a');
    await p.sendSystemNotice(group, 'Phase: BRIEFING');
    await p.deleteGroup(group);
    expect(token).toEqual({ token: 'test-only-token', appKey: 'test-app-key', region: 'SG' });
    expect(JSON.stringify(calls)).not.toContain('test-app-secret');
    const create = calls.find((c) => c.url.endsWith('/create'))!;
    const body = JSON.parse(String(create.init.body)) as {
      permissions: { joinPerm: number };
      owner: string;
      userIds: string[];
    };
    expect(body.permissions.joinPerm).toBe(3);
    expect(body.owner).toBe('scalesquadsystem');
    expect(body.userIds).toEqual([chatUserId('a')]);
    expect(chatUserId('a')).not.toBe(chatUserId('b'));
    for (const c of calls) {
      expect(c.init.method).toBe('POST');
      const headers = c.init.headers as Record<string, string>;
      expect(headers.Signature).toMatch(/^[a-f0-9]{40}$/);
      expect(headers.Nonce).toHaveLength(16);
    }
    const notice = calls.find((c) => c.url.endsWith('/message/send'));
    expect(String(notice?.init.body)).not.toContain('payload');
  });
  it('bounded failover, generic errors, malformed responses and compensating dismissal', async () => {
    const fail = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network secret'))
      .mockResolvedValue(Response.json({ code: 0, result: { accessToken: 't', userId: 'u' } }));
    await expect(
      new NexconnChatProvider('key', 'secret', 'NA', fail).mintUserToken('a'),
    ).resolves.toHaveProperty('token', 't');
    expect(String(fail.mock.calls[1]?.[0])).toContain('api-b.us-light-api.com');
    const unavailable: typeof fetch = async () => Response.json({ code: 500, detail: 'private' });
    await expect(
      new NexconnChatProvider('key', 'secret', 'SA', unavailable).mintUserToken('a'),
    ).rejects.toMatchObject({ safeMessage: 'Chat is unavailable' });
    const httpFail: typeof fetch = async () => new Response('private', { status: 500 });
    await expect(
      new NexconnChatProvider('key', 'secret', 'SG', httpFail).mintUserToken('a'),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    const call = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).endsWith('/create')
          ? Response.json({ code: 1 })
          : Response.json({ code: 0, result: { accessToken: 't', userId: 'u' } }),
      );
    await expect(
      new NexconnChatProvider('key', 'secret', 'SG', call).createGroup('m', ['a']),
    ).rejects.toThrow('Chat is unavailable');
    expect(call.mock.calls.some((c) => String(c[0]).endsWith('/dismiss'))).toBe(true);
  });
  it('disabled provider fails honestly; fake only exists for tests', async () => {
    const p = new DisabledChatProvider();
    expect(p.available).toBe(false);
    for (const fn of [
      () => p.createGroup(),
      () => p.addMember(),
      () => p.removeMember(),
      () => p.mintUserToken(),
      () => p.sendSystemNotice(),
      () => p.deleteGroup(),
    ])
      await expect(fn()).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    const fake = new FakeChatProvider();
    await fake.addMember('missing', 'a');
    await fake.removeMember('missing', 'a');
  });
});
