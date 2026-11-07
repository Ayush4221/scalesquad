import { test, expect } from './fixtures';

for (const mission of [
  { id: 'retry-storm', title: 'Retry Storm' },
  { id: 'split-gates', title: 'Split Gates' },
  { id: 'flash-crowd', title: 'Flash Crowd' },
])
  test(`host selects ${mission.title} and teammates inherit it`, async ({ squad: s }, testInfo) => {
    const host = s.players[0];
    await host.page.goto('/play');
    await host.page.getByRole('radio', { name: new RegExp(mission.title) }).check();
    await expect(
      host.page.getByRole('heading', { name: mission.title, exact: true }),
    ).toBeVisible();
    await expect(
      host.page.getByText('Inspired by the failure pattern.', { exact: false }),
    ).toBeVisible();
    expect(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (mission.id === 'retry-storm')
      await host.page.screenshot({
        path: testInfo.outputPath('mission-picker.png'),
        fullPage: true,
      });
    await host.page.getByRole('button', { name: 'Create squad', exact: true }).click();
    await expect(host.page).toHaveURL(/\/match\//);
    await expect(host.page).toHaveTitle('ScaleSquad');
    s.matchId = host.page.url().split('/').at(-1)!;
    const stored = await s.db.match.findUniqueOrThrow({ where: { id: s.matchId } });
    expect(stored.scenarioId).toBe(mission.id);
    const response = await s.post(s.players[1], '/matches/join', { code: stored.joinCode });
    expect(response.ok()).toBe(true);
    const joined = await response.json();
    expect(joined.scenario.scenarioId).toBe(mission.id);
    expect(joined.scenario).not.toHaveProperty('referenceRepair');
    expect(joined.scenario).not.toHaveProperty('profiles');
    await host.page.reload();
    const view = await (await host.context.request.get(`/api/game/matches/${s.matchId}`)).json();
    expect(view.scenario.scenarioId).toBe(mission.id);
  });
