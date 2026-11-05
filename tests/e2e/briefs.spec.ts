import { test, expect, briefing, selectTab } from './fixtures';
test('private evidence stays owner-only across HTTP, page, socket and chat surfaces', async ({
  squad: s,
}) => {
  const frames: string[] = [],
    outbound: string[] = [];
  for (const p of s.players) {
    p.page.on('websocket', (ws) =>
      ws.on('framereceived', (frame) => frames.push(String(frame.payload))),
    );
    p.context.on('request', (r) => {
      if (r.method() !== 'GET') outbound.push(r.postData() ?? '');
    });
  }
  await briefing(s);
  const cards = await s.db.privateEvidence.findMany({ where: { matchId: s.matchId } });
  const facts = (payload: unknown) =>
    (payload as { facts: { text: string }[] }).facts.map((f) => f.text);
  for (const p of s.players) {
    await selectTab(p.page, 'Brief');
    const own = cards.find((c) => c.userId === p.id)!;
    for (const fact of facts(own.payload))
      await expect(p.page.locator('.fact-list li').filter({ hasText: fact })).toBeVisible();
    const body = await p.page.locator('body').innerText();
    for (const card of cards.filter((c) => c.userId !== p.id))
      for (const fact of facts(card.payload)) expect(body).not.toContain(fact);
    const publicView = await (await p.context.request.get(`/api/game/matches/${s.matchId}`)).text();
    for (const c of cards)
      for (const fact of facts(c.payload)) expect(publicView).not.toContain(fact);
    expect(
      (
        await p.context.request.get(
          `/api/game/matches/${s.matchId}/evidence?userId=${s.outsider.id}`,
        )
      ).status(),
    ).toBe(400);
  }
  expect(
    (await s.outsider.context.request.get(`/api/game/matches/${s.matchId}/evidence`)).status(),
  ).toBe(403);
  const audit = JSON.stringify(await s.db.auditLog.findMany({ where: { matchId: s.matchId } }));
  for (const c of cards)
    for (const fact of facts(c.payload)) {
      expect(frames.join('')).not.toContain(fact);
      expect(outbound.join('')).not.toContain(fact);
      expect(audit).not.toContain(fact);
    }
});
