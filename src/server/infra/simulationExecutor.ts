import { Worker } from 'node:worker_threads';
import { resolve as resolvePath } from 'node:path';
import { AppError, SimulationResult } from '@scalesquad/shared';
import type { InputBundle } from '@scalesquad/sim';
import { prepareSimulationEngine } from './prepareSimulation';
export async function executeSimulation(
  bundle: InputBundle,
  timeoutMs: number,
): Promise<SimulationResult> {
  await prepareSimulationEngine();
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(resolvePath('src/sim/cli/worker.mjs'), {
      workerData: bundle,
      execArgv: [],
    });
    const finish = (error?: AppError, result?: SimulationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(
      () => finish(new AppError('INTERNAL', 500, 'Simulation timed out; retry is available')),
      timeoutMs,
    );
    worker.once('message', (value: unknown) => {
      if (settled) return;
      const parsed = SimulationResult.safeParse(value);
      if (parsed.success) finish(undefined, parsed.data);
      else finish(new AppError('INTERNAL', 500));
    });
    worker.once('error', () => {
      finish(new AppError('INTERNAL', 500));
    });
    worker.once('exit', () => {
      finish(new AppError('INTERNAL', 500));
    });
  });
}
