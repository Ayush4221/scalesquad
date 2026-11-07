import { expect, test } from './fixtures';
import { buildContentSecurityPolicy } from '../../src/utils/contentSecurityPolicy';

test('chat policy permits SDK edge navigation and WebSocket connections', async ({
  page,
  baseURL,
}) => {
  const policy = buildContentSecurityPolicy({ appOrigin: baseURL! });
  await page.route('**/__chat-policy-probe', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': policy },
      body: '<p>Chat policy probe</p>',
    }),
  );
  await page.route('https://dualstack-nav.sg-light-edge.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{"ok":true}',
    }),
  );
  await page.routeWebSocket('wss://dualstack-ws.sg-light-edge.com/**', (socket) =>
    socket.send('connected'),
  );
  await page.goto('/__chat-policy-probe');
  expect(
    await page.evaluate(async () => {
      const response = await fetch('https://dualstack-nav.sg-light-edge.com/probe');
      return response.ok;
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const socket = new WebSocket('wss://dualstack-ws.sg-light-edge.com/probe');
          const timer = setTimeout(() => {
            socket.close();
            resolve(false);
          }, 5000);
          socket.onopen = () => {
            clearTimeout(timer);
            socket.close();
            resolve(true);
          };
          socket.onerror = () => {
            clearTimeout(timer);
            resolve(false);
          };
        }),
    ),
  ).toBe(true);
});

test('request nonces protect built pages and client navigation still hydrates', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = window as typeof window & { cspViolations: object[] };
    target.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      target.cspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
      }),
    );
  });
  const response = await page.goto('/');
  const csp = response!.headers()['content-security-policy']!;
  const scripts = csp.split(';').find((directive) => directive.trim().startsWith('script-src'))!;
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  const nonce = /'nonce-([^']+)'/.exec(scripts)?.[1];
  expect(nonce).toBeTruthy();
  const inline = await page
    .locator('script:not([src])')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
  expect(inline.length).toBeGreaterThan(0);
  expect(inline.every((value) => value === nonce)).toBe(true);
  const next = await page.context().request.get('/');
  expect(next.headers()['content-security-policy']).not.toContain(`'nonce-${nonce}'`);
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await expect(page).toHaveURL(/\/signin$/);
  const password = page.getByLabel('Password', { exact: true });
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  expect(
    await page.evaluate(
      () => (window as typeof window & { cspViolations: object[] }).cspViolations,
    ),
  ).toEqual([]);
});
