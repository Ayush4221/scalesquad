import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ConfigurationValues } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import { makeBundle, runMatchSimulations, simulate } from '../index';

export async function main(argv: string[], write: (s: string) => void): Promise<number> {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        scenario: { type: 'string', default: 'campuspass' },
        repair: { type: 'string', default: 'reference' },
        config: { type: 'string' },
        json: { type: 'boolean' },
        verbose: { type: 'boolean' },
      },
      strict: true,
    });
    const scenario = loadScenario(values.scenario);
    const readConfig = async (path: string) =>
      ConfigurationValues.parse(JSON.parse(await readFile(path, 'utf8')) as unknown);
    const presetConfig = values.config
      ? await readConfig(values.config)
      : scenario.presetConfiguration;
    const repairedConfig =
      values.repair === 'reference' ? scenario.referenceRepair : await readConfig(values.repair);
    const output = runMatchSimulations({ scenario, presetConfig, repairedConfig });
    if (values.json) write(JSON.stringify(output));
    else {
      write('Run | Status | Valid | Duplicates | P95 ms | Cost');
      output.runs.forEach((r, i) => {
        write(
          `${i + 1} | ${r.status} | ${r.validAdmissions} | ${r.duplicateAdmissions} | ${r.p95LatencyMs.toFixed(1)} | ${r.totalCost}`,
        );
        r.failureReasons.forEach((f) => write(`${f.code}: ${f.message}`));
      });
      write(`Incident comparison: ${output.comparison.status}`);
      output.comparison.tradeoffs.forEach(write);
    }
    if (values.verbose)
      write(
        JSON.stringify(
          simulate(makeBundle(scenario, repairedConfig, 'incident'), true).trace.map((state) => ({
            t: state.t,
            counters: state.counters,
            pending: state.pending.length,
            backlog: state.queue.length,
            observations: state.observations,
          })),
        ),
      );
    return output.runs[2].overallGatePassed ? 0 : 1;
  } catch {
    write(
      'Invalid command or configuration. Use --scenario campuspass --repair reference [--json] [--verbose].',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2), (line) => process.stdout.write(`${line}\n`));
