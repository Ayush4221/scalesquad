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
  await expect(
    host.page.getByRole('heading', { name: 'What you changed', exact: true }),
  ).toBeVisible();
  const changes = host.page.getByRole('region', { name: 'Configuration changes' });
  await expect(changes.getByText('Atomic check-in', { exact: true })).toBeVisible();
  await expect(changes.getByText('Off → On', { exact: true })).toBeVisible();
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
test('a failed run request keeps the repair editable and can be retried', async ({
  squad: s,
}, testInfo) => {
  await repair(s);
  const page = s.players[0].page;
  await selectTab(page, 'Repair');
  const runPath = `**/api/game/matches/${s.matchId}/runs`;
  await page.route(
    runPath,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Run unavailable. Try again.' } }),
      }),
    { times: 1 },
  );
  const runButton = page.getByRole('button', { name: 'Run baseline + incident' });
  const activate = () => (testInfo.project.use.hasTouch ? runButton.tap() : runButton.click());
  const isRunResponse = (response: import('@playwright/test').Response) =>
    response.url().endsWith(`/matches/${s.matchId}/runs`) && response.request().method() === 'POST';
  const [failed] = await Promise.all([page.waitForResponse(isRunResponse), activate()]);
  expect(failed.status()).toBe(503);
  await expect(page.locator('.error[role="alert"]')).toContainText(/try again/i);
  await expect(page.getByLabel('App capacity', { exact: true })).toBeEnabled();
  await page.unroute(runPath);
  const [retried] = await Promise.all([page.waitForResponse(isRunResponse), activate()]);
  expect(retried.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Reveal incident evidence' })).toBeEnabled({
    timeout: 30000,
  });
});
