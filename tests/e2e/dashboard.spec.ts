import { test, expect } from './fixtures';

test('dashboard validates locally, recovers from failure and fits narrow screens', async ({
  squad: s,
}, testInfo) => {
  const page = s.players[0].page;
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: 'Your squad starts here.' })).toBeVisible();
  const code = page.getByRole('textbox', { name: 'Join code' });
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('8-character');
  await code.fill('abcdefgh');
  await expect(code).toHaveValue('ABCDEFGH');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  let calls = 0;
  await page.route('**/api/game/matches', async (route) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Try again shortly.' } }),
    });
  });
  const create = page.getByRole('button', { name: 'Create squad', exact: true });
  await create.click();
  await expect(page.getByRole('button', { name: 'Creating squad…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Try again shortly.');
  await expect(create).toBeEnabled();
  expect(calls).toBe(1);
  await create.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Try again shortly.');
  expect(calls).toBe(2);
  await page.unroute('**/api/game/matches');
  await page.reload();
  await expect(create).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(create).toBeVisible();
  await expect(code).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-narrow.png'), fullPage: true });
});
