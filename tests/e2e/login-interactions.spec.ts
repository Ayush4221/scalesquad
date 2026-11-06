import { test, expect } from '@playwright/test';

test('sign-in loading keeps its size, locks controls, and restores a safe retry', async ({
  page,
}, testInfo) => {
  let attempts = 0;
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/game/auth/login', async (route) => {
    attempts++;
    if (attempts === 1) await responseReady;
    await route.fulfill({
      status: attempts === 1 ? 503 : 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'private backend diagnostic' } }),
    });
  });
  try {
    await page.goto('/signin');
    await page.bringToFront();
    const email = page.getByLabel('Email address', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await email.fill('player@example.invalid');
    await password.fill('Existing password');
    const before = await submit.boundingBox();
    await password.press('Enter');
    const pending = page.getByRole('button', { name: 'Signing in', exact: true });
    await expect(pending).toBeDisabled();
    await expect(pending).toHaveAttribute('aria-busy', 'true');
    await expect(pending.locator('[data-slot="login-loading"]')).toHaveCSS('opacity', '1');
    await expect(pending.locator('[data-slot="login-idle"]')).toHaveCSS('opacity', '0');
    await expect(email).toBeDisabled();
    await expect(password).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Show password', exact: true })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const loading = await pending.boundingBox();
    expect(Math.abs(before!.width - loading!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(before!.height - loading!.height)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Enter');
    expect(attempts).toBe(1);
    release();
    const error = page.getByRole('main').getByRole('alert');
    await expect(error).toContainText('Could not sign in with those details');
    await expect(error).toBeFocused();
    await expect(page.getByText('private backend diagnostic')).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await expect(password).toHaveValue('Existing password');
    await expect(email).toBeEnabled();
    const response = page.waitForResponse(
      (value) =>
        value.url().endsWith('/api/game/auth/login') && value.request().method() === 'POST',
    );
    if (testInfo.project.use.hasTouch) await submit.tap();
    else await submit.click();
    expect((await response).status()).toBe(401);
    await expect(error).toBeVisible();
    await expect(submit).toBeEnabled();
    expect(attempts).toBe(2);
    await expect(page).toHaveURL(/\/signin$/);
  } finally {
    release();
  }
});

test('sign-in stays readable and usable with reduced motion and keyboard focus', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/game/auth/login', async (route) => {
    await responseReady;
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  try {
    await page.goto('/signin');
    await page.bringToFront();
    const email = page.getByLabel('Email address', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    await email.fill('player@example.invalid');
    await password.fill('Existing password');
    await password.press('Tab');
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
    await page.keyboard.press('Tab');
    const submit = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(submit).toBeFocused();
    const focus = await submit.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: parseFloat(style.outlineWidth), ring: style.boxShadow };
    });
    expect(focus.outline > 0 || focus.ring !== 'none').toBe(true);
    await page.keyboard.press('Enter');
    const pending = page.getByRole('button', { name: 'Signing in', exact: true });
    // The app-wide reset retains 0.01ms transitions; both it and zero are effectively immediate.
    const durations = await pending.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map((duration) => parseFloat(duration) * (duration.trim().endsWith('ms') ? 1 : 1000)),
    );
    expect(Math.max(...durations)).toBeLessThanOrEqual(1);
    await expect(pending.locator('svg.lucide-loader-circle')).toHaveCSS('animation-name', 'none');
    const fit = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(fit.content).toBeLessThanOrEqual(fit.viewport);
    release();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  } finally {
    release();
  }
});
