import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'story-capture.spec.ts',
  timeout: 480000,
  outputDir: resolve('.cache/submission-v2/capture-results'),
});
