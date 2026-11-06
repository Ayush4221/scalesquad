import { test, expect } from './fixtures';

test('guests see the public home before auth screens and can follow both account paths', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (/hydrat|server.rendered|#418|#425/i.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
    'System under load. Squad up.',
  );
  await expect(page.getByText(/ScaleSquad is a three-player system design game/)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  const fit = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(fit.content).toBeLessThanOrEqual(fit.viewport);
  await page.getByRole('link', { name: 'Create your squad', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel('Full name').fill('Demo Engineer');
  await expect(page.getByLabel('Full name')).toHaveValue('Demo Engineer');
  await page.getByRole('link', { name: 'ScaleSquad home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByLabel('Email address').fill('demo@example.invalid');
  await expect(page.getByLabel('Email address')).toHaveValue('demo@example.invalid');
  expect(errors).toEqual([]);
});

test('home preview and keyboard navigation stay usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.bringToFront();
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#home-main$/);
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: 'Next scene' }).click();
  await expect(page.getByRole('heading', { name: 'A surge hits the gates.' })).toBeVisible();
  const animations = await page
    .locator('h1 span')
    .evaluateAll((items) => items.map((item) => getComputedStyle(item).animationName));
  expect(animations.every((name) => name === 'none')).toBe(true);
  await page.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(
    page.getByRole('heading', { name: 'Every clue needs a teammate.' }),
  ).toBeInViewport();
});

test('signed-in visitors still enter the game from the home URL', async ({ squad: s }) => {
  await s.players[0].page.goto('/');
  await expect(s.players[0].page).toHaveURL(/\/play$/);
  await expect(s.players[0].page.getByRole('button', { name: 'Create squad' })).toBeEnabled();
});
