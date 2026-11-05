import { test, expect, completeMatch, repair, selectTab } from './fixtures';
test('three players finish a fair baseline, incident and successful UI repair', async ({
  squad: s,
}) => {
  await completeMatch(s);
  const [host] = s.players;
  const view = (await (
    await host.context.request.get(`/api/game/matches/${s.matchId}`)
  ).json()) as {
    runs: { runNumber: number; result: { status: string; sharedInputHash: string } }[];
    comparison: { status: string };
  };
  expect(view.runs.find((r) => r.runNumber === 2)?.result.status).toBe('FAILED');
  expect(view.runs.find((r) => r.runNumber === 3)?.result.status).toBe('PASSED');
  expect(view.runs[1]!.result.sharedInputHash).toBe(view.runs[2]!.result.sharedInputHash);
  expect(view.comparison.status).toBe('PASSED');
  await expect(host.page.getByText('Same incident. A different design.')).toBeVisible();
  if (await host.page.getByRole('navigation', { name: 'Match sections' }).isVisible()) {
    await expect(host.page.locator('.mobile-metrics')).toBeVisible();
    await expect(host.page.locator('.desktop-metrics')).toBeHidden();
  } else {
    await expect(host.page.locator('.desktop-metrics')).toBeVisible();
    await expect(host.page.locator('.mobile-metrics')).toBeHidden();
  }
  await host.page.getByRole('button', { name: 'Finish match', exact: true }).click();
  await expect(host.page.locator('.status-bar')).toContainText('FINISHED');
  await expect(host.page.getByRole('link', { name: 'Play again' })).toBeVisible();
});
test('a failed run request keeps the repair editable and can be retried', async ({ squad: s }) => {
  await repair(s);
  const page = s.players[0].page;
  await selectTab(page, 'Repair');
  await page.route(
    `**/api/game/matches/${s.matchId}/runs`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Run unavailable. Try again.' } }),
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Run baseline + incident' }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText('Try again');
  await expect(page.getByLabel('App capacity', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Run baseline + incident' }).click();
  await expect(page.getByRole('button', { name: 'Reveal incident evidence' })).toBeEnabled({
    timeout: 30000,
  });
});
