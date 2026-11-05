import { test, expect, repair, selectTab } from './fixtures';
test('360px match has tabs, readable inputs, large targets and a mobile repair drawer', async ({
  squad: s,
}) => {
  const page = s.players[0].page;
  await page.setViewportSize({ width: 360, height: 800 });
  await repair(s);
  await selectTab(page, 'Repair');
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('body *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > innerWidth + 1;
      })
      .map((e) => ({
        tag: e.tagName,
        classes: e.className,
        right: e.getBoundingClientRect().right,
      })),
  }));
  expect(overflow.width, JSON.stringify(overflow.elements)).toBeLessThanOrEqual(overflow.viewport);
  await expect(page.getByRole('navigation', { name: 'Match sections' })).toBeVisible();
  await page.getByLabel('App capacity', { exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('data-presentation', 'drawer');
  await page.getByRole('dialog').getByRole('button', { name: 'MEDIUM', exact: true }).click();
  await expect(page.getByText('v1', { exact: true })).toBeVisible();
  const targets = await page
    .getByRole('navigation', { name: 'Match sections' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(targets.every((height) => height >= 44)).toBe(true);
});
