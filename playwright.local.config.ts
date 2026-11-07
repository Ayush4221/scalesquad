import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Local smoke suite against the developer's own server, `.env` and database.
 * Unlike the main E2E suite it does not create an isolated *_test database:
 * it signs up real users through the UI and deletes only the users it made.
 *
 *   npm run test:e2e:local
 *
 * Reuses a server already running at APP_ORIGIN, or starts `npm run dev`.
 */
if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production')
  throw new Error('The local suite writes test users; never point it at production');

const baseURL = process.env.E2E_LOCAL_BASE_URL ?? process.env.APP_ORIGIN ?? 'http://localhost:3000';
const origin = new URL(baseURL);
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
  throw new Error('The local suite only runs against a loopback HTTP origin');

export default defineConfig({
  testDir: './tests/e2e/local',
  testMatch: '**/*.local.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/local' }]],
  outputDir: 'test-results/local',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev',
    url: `${baseURL}/healthz`,
    reuseExistingServer: true,
    timeout: 180000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [{ name: 'local-chromium' }],
});
