import { test, expect, completeMatch } from './fixtures';
test('manifest, headers, worker offline fallback, private cache exclusion and logout purge', async ({
  squad: s,
}) => {
  const page = s.players[0].page;
  const manifest = await s.players[0].context.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const m = (await manifest.json()) as {
    start_url: string;
    display: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(m.start_url).toBe('/play');
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  const worker = await s.players[0].context.request.get('/sw.js');
  expect(worker.headers()['cache-control']).toContain('no-cache');
  await completeMatch(s);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const entries = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    return urls;
  });
  expect(entries.length).toBeGreaterThan(0);
  for (const url of entries) {
    const path = new URL(url).pathname;
    expect(path).not.toMatch(/^\/(api|match|signin|register|verify|reset-password)/);
  }
  const api = await s.players[0].context.request.get(`/api/game/matches/${s.matchId}/evidence`);
  expect(api.headers()['cache-control']).toContain('no-store');
  expect(api.headers()['content-security-policy']).toContain("worker-src 'self'");
  await s.players[0].context.setOffline(true);
  await page.goto('/play');
  await page.evaluate(async () => {
    const proof = await caches.open('logout-purge-proof');
    await proof.put('/__e2e-cache-canary', new Response('disposable test marker'));
    for (const name of await caches.keys())
      await (
        await caches.open(name)
      ).put('/__e2e-cache-canary', new Response('disposable test marker'));
  });
  await expect(page.getByRole('heading', { name: 'You’re offline.' })).toBeVisible();
  await s.players[0].context.setOffline(false);
  await page.goto('/play');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/signin/);
  expect(await page.evaluate(() => caches.keys())).not.toContain('logout-purge-proof');
  const after = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        urls.push(new URL(request.url).pathname);
    return urls;
  });
  // The public sign-in page may refill approved static assets after the purge.
  expect(after).not.toContain('/__e2e-cache-canary');
  for (const path of after) expect(path).toMatch(/^\/(?:_next\/static\/|icons\/|fonts\/|offline$)/);
});
