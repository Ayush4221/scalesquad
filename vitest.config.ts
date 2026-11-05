import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@scalesquad/scenario/public',
        replacement: fileURLToPath(new URL('./src/scenario/public.ts', import.meta.url)),
      },
      {
        find: '@scalesquad/nexconn/fake',
        replacement: fileURLToPath(new URL('./src/nexconn/fake.ts', import.meta.url)),
      },
      {
        find: '@scalesquad/nexconn/provider',
        replacement: fileURLToPath(new URL('./src/nexconn/provider.ts', import.meta.url)),
      },
      ...['shared', 'scenario', 'sim', 'db', 'nexconn'].map((name) => ({
        find: `@scalesquad/${name}`,
        replacement: fileURLToPath(new URL(`./src/${name}/index.ts`, import.meta.url)),
      })),
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    exclude: ['**/node_modules/**', '**/.next/**', '**/*.db.test.ts'],
    projects: [
      ...['shared', 'scenario', 'sim', 'db', 'nexconn'].map((name) => ({
        extends: true,
        test: {
          name,
          environment: 'node' as const,
          include: [`tests/${name}/**/*.test.ts`],
          exclude: ['**/*.db.test.ts'],
        },
      })),
      {
        extends: true,
        test: { name: 'server', environment: 'node', include: ['tests/server/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['tests/web/**/*.test.ts', 'tests/web/**/*.test.tsx'],
          setupFiles: ['./tests/web/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/{sim,scenario,shared,db,nexconn}/**/*.ts',
        'src/server/**/*.ts',
        'src/pwa/**/*.ts',
        'src/pwa/**/*.tsx',
      ],
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
        '**/types.ts',
        '**/main.ts',
        '**/prisma/**',
        'src/sim/cli/**',
      ],
      thresholds: {
        'src/sim/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/shared/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/scenario/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/server/services/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/server/middleware/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/server/controllers/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/server/controllers/authController.ts': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/server/controllers/pushController.ts': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/server/services/authService.ts': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/server/services/pushService.ts': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/pwa/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
