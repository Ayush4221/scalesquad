import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';
export default defineConfig({
  resolve: base.resolve ?? {},
  test: {
    include: ['tests/**/*.db.test.ts'],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
  },
});
