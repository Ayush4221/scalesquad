import { describe, it, expect } from 'vitest';
import { executeSimulation } from '../../../src/server/infra/simulationExecutor';
import { loadScenario } from '@scalesquad/scenario';
import { makeBundle, runSimulation } from '@scalesquad/sim';
describe('bounded worker execution', () => {
  const s = loadScenario(),
    bundle = makeBundle(s, s.referenceRepair, 'incident');
  it('worker result equals pure simulator result', async () => {
    expect(await executeSimulation(bundle, 15000)).toEqual(runSimulation(bundle));
  }, 20000);
  it('hard timeout terminates a worker and returns safe error', async () => {
    await expect(executeSimulation(bundle, 1)).rejects.toMatchObject({
      code: 'INTERNAL',
      safeMessage: 'Simulation timed out; retry is available',
    });
  });
});
