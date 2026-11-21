import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import base from '../../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'capture.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 360000,
  outputDir: resolve('.cache/submission-capture/results'),
  reporter: [['list']],
  webServer: {
    command: 'npx tsx tests/e2e/startServer.ts',
    cwd: resolve('.'),
    url: 'http://127.0.0.1:37231/healthz',
    timeout: 120000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [{ name: 'submission', use: { ...devices['Desktop Chrome'] } }],
});
