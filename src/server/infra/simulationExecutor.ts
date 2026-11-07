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
    const timer = setTimeout(() => {
      settled = true;
      void worker.terminate();
      reject(new AppError('INTERNAL', 500, 'Simulation timed out; retry is available'));
    }, timeoutMs);
    worker.once('message', (value: unknown) => {
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      const parsed = SimulationResult.safeParse(value);
      if (parsed.success) resolve(parsed.data);
      else reject(new AppError('INTERNAL', 500));
    });
    worker.once('error', () => {
      settled = true;
      clearTimeout(timer);
      reject(new AppError('INTERNAL', 500));
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      if (!settled) reject(new AppError('INTERNAL', 500));
    });
  });
}
