import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
describe('MVC boundaries', () => {
  it('a controller cannot import the database directly', async () => {
    const linter = new ESLint();
    const results = await linter.lintText(
      "import { getPrisma } from '@scalesquad/db'; getPrisma();",
      { filePath: 'src/server/controllers/boundary.fixture.ts' },
    );
    expect(
      results.flatMap((r) => r.messages).some((m) => m.ruleId === 'boundaries/dependencies'),
    ).toBe(true);
  });
  it('the View cannot import the full private scenario', async () => {
    const linter = new ESLint();
    const results = await linter.lintText(
      "import {loadScenario} from '@scalesquad/scenario'; loadScenario();",
      { filePath: 'src/features/boundary.fixture.ts' },
    );
    expect(
      results.flatMap((r) => r.messages).some((m) => m.ruleId === 'no-restricted-imports'),
    ).toBe(true);
  });
});
