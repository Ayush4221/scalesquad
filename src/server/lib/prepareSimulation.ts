import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { AppError } from '@scalesquad/shared';

let ready: Promise<void> | undefined;
/** Development compiles once per process; production uses the regular build output. */
export function prepareSimulationEngine(): Promise<void> {
  ready ??=
    process.env.NODE_ENV === 'production'
      ? Promise.resolve()
      : promisify(execFile)(
          process.execPath,
          [resolve('node_modules/typescript/lib/tsc.js'), '-p', 'tsconfig.sim.json'],
          { timeout: 30000, windowsHide: true },
        )
          .then(() => {})
          .catch(() => {
            throw new AppError('INTERNAL', 500, 'Simulation engine unavailable');
          });
  return ready;
}
