import { test, expect } from '@playwright/test';
import { loadCredentials } from './settings';
for (const role of ['host', 'player2', 'player3', 'outsider'] as const) {
  test(`configured ${role} can sign in and access their session`, async ({ browser }) => {
    test.skip(process.env.E2E_LIVE_ONLY !== '1', 'Run the explicit test:e2e:configured command');
    const config = await loadCredentials(),
      user = config.users[role];
    test.skip(
      !config.baseURL || !user.email || !user.password,
      'Fill the ignored common credentials.js file or E2E_* environment variables',
    );
    const url = new URL(config.baseURL);
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
      throw new Error('Configured credential tests require HTTPS or local HTTP');
    // Native fetch avoids recording credential entry or request bodies in browser steps.
    let cookie = '';
    try {
      const response = await fetch(new URL('/api/game/auth/login', url), {
        method: 'POST',
        headers: { Origin: url.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
        redirect: 'error',
      });
      if (!response.ok) throw new Error();
      cookie =
        response.headers
          .getSetCookie()
          .find(
            (c) =>
              c.startsWith('authjs.session-token=') ||
              c.startsWith('__Secure-authjs.session-token='),
          ) ?? '';
      if (!cookie) throw new Error();
    } catch {
      throw new Error('Configured account sign-in failed; request details suppressed');
    }
    const context = await browser.newContext({ baseURL: url.origin });
    try {
      const first = cookie.split(';')[0]!,
        equals = first.indexOf('=');
      await context.addCookies([
        {
          name: first.slice(0, equals),
          value: first.slice(equals + 1),
          url: url.origin,
          httpOnly: true,
          secure: url.protocol === 'https:',
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      await page.goto('/play');
      await expect(page).toHaveURL(new RegExp('/play$'));
      expect((await context.request.get('/api/game/me')).ok()).toBe(true);
    } finally {
      await context.request
        .post('/api/game/auth/logout', { data: {}, headers: { Origin: url.origin } })
        .catch(() => {});
      await context.close();
    }
  });
}
