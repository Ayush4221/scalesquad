import { defineConfig, devices } from '@playwright/test';
import { localBaseURL } from './tests/e2e/settings';
const liveOnly = process.env.E2E_LIVE_ONLY === '1';
if (!liveOnly) {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'test')
    throw new Error('E2E seeding requires NODE_ENV=test');
  Object.assign(process.env, { NODE_ENV: 'test' });
}
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  // Tests own their users/matches and send per-context client IPs, so files can
  // run in parallel against the one server. Override with E2E_WORKERS or --workers.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: localBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  ...(liveOnly
    ? {}
    : {
        webServer: {
          command: 'npx tsx tests/e2e/startServer.ts',
          url: `${localBaseURL}/healthz`,
          reuseExistingServer: false,
          timeout: 120000,
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/configured-users.spec.ts',
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 7'] },
      testIgnore: ['**/configured-users.spec.ts', '**/pwa.spec.ts'],
    },
    {
      name: 'mobile-ios',
      use: { ...devices['iPhone 13'] },
      testIgnore: ['**/configured-users.spec.ts', '**/pwa.spec.ts'],
    },
    {
      name: 'configured-users',
      testMatch: '**/configured-users.spec.ts',
      use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off', video: 'off' },
    },
  ],
});
