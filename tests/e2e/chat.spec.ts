import { test, expect, briefing, selectTab } from './fixtures';
test('sharing evidence opens a draft without sending, and chat failure leaves the game playable', async ({
  squad: s,
}) => {
  await briefing(s);
  const page = s.players[0].page;
  await selectTab(page, 'Brief');
  const fact = (
    await s.db.privateEvidence.findFirstOrThrow({
      where: { matchId: s.matchId, userId: s.players[0].id },
    })
  ).payload as { facts: { text: string }[] };
  const sends: string[] = [];
  page.on('request', (r) => {
    if (r.postData()?.includes(fact.facts[0]!.text)) sends.push(r.url());
  });
  await page.getByRole('button', { name: 'Share to squad…' }).first().click();
  await expect(page.getByRole('textbox', { name: 'Message your squad' })).toHaveValue(
    fact.facts[0]!.text,
  );
  expect(sends).toEqual([]);
  await expect(page.locator('.chat-card [role="status"]')).toContainText(/unavailable/i, {
    timeout: 20000,
  });
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect((await s.players[0].context.request.get(`/api/game/matches/${s.matchId}`)).ok()).toBe(
    true,
  );
});
