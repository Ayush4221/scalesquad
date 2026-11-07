import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import { resolve } from 'node:path';

const serverTypes = [
  'controller',
  'service',
  'repository',
  'middleware',
  'ws',
  'route',
  'lib',
  'config',
];
const allowed = {
  controller: ['service', 'shared', 'lib'],
  service: ['service', 'repository', 'sim', 'scenario', 'shared', 'nexconn', 'lib'],
  repository: ['repository', 'db', 'shared', 'lib'],
  middleware: ['middleware', 'service', 'shared', 'lib'],
  ws: ['ws', 'controller', 'middleware', 'service', 'shared', 'lib'],
  route: ['controller', 'middleware', 'service', 'shared', 'lib'],
  lib: ['lib', 'shared', 'sim'],
  config: ['config', 'shared'],
  sim: ['sim', 'scenario', 'shared'],
  scenario: ['scenario', 'shared'],
  shared: ['shared'],
  db: ['db'],
  nexconn: ['nexconn', 'shared'],
  web: ['web', 'shared'],
  utils: ['utils'],
  constants: ['constants', 'shared'],
};
// Shared helpers are browser-safe. Server helpers remain within the server layer.
for (const types of Object.values(allowed)) types.push('utils', 'constants');
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'tests/e2e/credentials.js',
      '**/next-env.d.ts',
      '.cache/**',
      'tests/fixtures/**',
      'apps/web/eslint.config.mjs',
    ],
  },
  ...tseslint.configs.recommended,
  { files: ['scripts/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^(\\$queryRaw|\\$executeRaw)/]',
          message: 'Raw SQL is forbidden',
        },
        {
          selector: "CallExpression[callee.name='eval']",
          message: 'Dynamic evaluation is forbidden',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Unsafe HTML is forbidden',
        },
      ],
    },
  },
  {
    files: [
      'src/server/**/*.ts',
      'src/{sim,scenario,shared,db,nexconn,utils,constants}/**/*.ts',
      'src/{app,auth,components,features,lib,hooks,pwa,styles}/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.ts', '**/*.test.tsx', 'src/server/main.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { [resolve(import.meta.dirname, 'scripts/eslintResolver.cjs')]: {} },
      'boundaries/root-path': import.meta.dirname,
      'boundaries/elements': [
        {
          type: 'lib',
          pattern: 'src/server/{utils,constants,domain,infra}/**',
          partialMatch: false,
        },
        ...['utils', 'constants'].map((type) => ({
          type,
          pattern: `src/${type}/**`,
          partialMatch: false,
        })),
        ...serverTypes.map((type) => ({
          type,
          pattern: `src/server/${type === 'route' ? 'routes' : type === 'lib' || type === 'config' || type === 'middleware' || type === 'ws' ? type : type + 's'}/**`,
          partialMatch: false,
        })),
        ...['sim', 'scenario', 'shared', 'db', 'nexconn'].map((type) => ({
          type,
          pattern: `src/${type}/**`,
          partialMatch: false,
        })),
        {
          type: 'web',
          pattern: 'src/{app,auth,components,features,lib,hooks,pwa,styles}/**',
          partialMatch: false,
        },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: Object.entries(allowed).map(([type, types]) => ({
            from: { element: { type } },
            allow: { to: { element: { types } } },
          })),
        },
      ],
    },
  },
  {
    files: ['src/{app,auth,components,features,lib,hooks}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@scalesquad/db',
                '@scalesquad/db/*',
                '@scalesquad/sim',
                '@scalesquad/sim/*',
                '@scalesquad/server',
                '@scalesquad/server/*',
                '@scalesquad/scenario',
                '@scalesquad/scenario/src/*',
              ],
              message: 'Only public contracts and scenario/public may reach the View',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/sim/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'Date', 'process', 'fetch'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random' }],
      'no-restricted-imports': [
        'error',
        { patterns: ['node:*', 'fs', 'http', 'https', 'ws', '@prisma/*'] },
      ],
    },
  },
  prettier,
);
