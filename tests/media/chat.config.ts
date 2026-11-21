import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'chat-capture.spec.ts',
  timeout: 600000,
  outputDir: resolve('.cache/chat-demo/capture-results'),
  use: { ...base.use, actionTimeout: 15000 },
  webServer: {
    ...base.webServer,
    command: 'npx tsx tests/media/startLiveServer.ts',
    cwd: resolve('.'),
    url: 'http://127.0.0.1:37231/healthz',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
