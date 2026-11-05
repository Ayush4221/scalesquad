import { describe, it, expect } from 'vitest';
import { main } from '../../src/sim/cli/main';
import { SimulationResult } from '@scalesquad/shared';
describe('CLI developer contract', () => {
  it('valid JSON, table, verbose and exit code mapping', async () => {
    const out: string[] = [];
    expect(await main(['--json'], (s) => out.push(s))).toBe(0);
    const parsed = JSON.parse(out[0]!) as { runs: unknown[] };
    parsed.runs.forEach((r) => expect(SimulationResult.safeParse(r).success).toBe(true));
    const table: string[] = [];
    expect(await main(['--repair', 'reference'], (s) => table.push(s))).toBe(0);
    expect(table.join('\n')).toContain('Incident comparison: PASSED');
    const trace: string[] = [];
    expect(await main(['--verbose'], (s) => trace.push(s))).toBe(0);
    expect(trace.at(-1)).toContain('observations');
  }, 30000);
  it('unknown flags, invalid scenario and missing file fail safely', async () => {
    for (const args of [
      ['--unknown'],
      ['--scenario', 'wrong'],
      ['--repair', 'missing-file'],
      ['--config', 'missing-file'],
    ])
      expect(await main(args, () => {})).toBe(1);
  });
});
