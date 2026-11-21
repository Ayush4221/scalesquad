import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  outputDir: resolve('.cache/android-native/results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve('.cache/android-native/report'), open: 'never' }],
  ],
});
