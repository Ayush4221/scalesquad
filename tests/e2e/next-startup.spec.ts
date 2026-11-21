import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';

test('standalone Next initializes auth before rendering public pages', async ({
  page,
  request,
}) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No local test port available');
  const origin = `http://127.0.0.1:${address.port}`;
  await new Promise<void>((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });

  // Never inherit local database, OAuth or provider credentials in this process.
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const line of (await readFile('.env.example', 'utf8')).split(/\r?\n/)) {
    const name = /^([A-Z_]+)=/.exec(line)?.[1];
    if (name) env[name] = '';
  }
  Object.assign(env, {
    NODE_ENV: 'production',
    APP_ORIGIN: origin,
    AUTH_URL: origin,
    AUTH_SECRET: randomBytes(48).toString('base64url'),
    // Guest requests must not need a database connection.
    DATABASE_URL: 'postgresql://guest@127.0.0.1:1/scalesquad_standalone_test',
    DIRECT_URL: 'postgresql://guest@127.0.0.1:1/scalesquad_standalone_test',
    NEXT_TELEMETRY_DISABLED: '1',
  });
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', String(address.port), '-H', '127.0.0.1'],
    { env, windowsHide: true, stdio: 'ignore' },
  );
  try {
    await expect
      .poll(
        async () => {
          if (server.exitCode !== null) return `Next exited: ${server.exitCode}`;
          try {
            return (await request.get(origin, { timeout: 1000 })).status();
          } catch {
            return 'starting';
          }
        },
        {
          timeout: 20000,
          message: 'Standalone Next must serve the homepage without a custom server',
        },
      )
      .toBe(200);

    const providers = await request.get(`${origin}/api/auth/providers`);
    expect(providers.status()).toBe(200);
    expect(await providers.json()).toEqual({});
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Think as a squad.');
    await page.getByRole('link', { name: 'Build your squad', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/register`);
    await page.getByRole('link', { name: 'ScaleSquad home' }).click();
    await expect(page).toHaveURL(`${origin}/`);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Sign in' })
      .click();
    await expect(page).toHaveURL(`${origin}/signin`);
    await page.goto(`${origin}/play`);
    await expect(page).toHaveURL(`${origin}/signin`);
    expect(errors).toEqual([]);
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
  }
});
