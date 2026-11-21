import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScenario } from '@scalesquad/scenario';
import { makeBundle, runSimulation } from '@scalesquad/sim';
import { executeSimulation } from '../../../src/server/infra/simulationExecutor';

const state = vi.hoisted(() => ({
  workers: [] as (EventEmitter & { terminate: ReturnType<typeof vi.fn> })[],
}));
vi.mock('node:worker_threads', () => ({
  Worker: class extends EventEmitter {
    terminate = vi.fn(async () => 0);
    constructor() {
      super();
      state.workers.push(this);
    }
  },
}));
vi.mock('../../../src/server/infra/prepareSimulation', () => ({
  prepareSimulationEngine: async () => {},
}));
afterEach(() => {
  vi.useRealTimers();
  state.workers.length = 0;
});
describe('single worker settlement', () => {
  const scenario = loadScenario(),
    bundle = makeBundle(scenario, scenario.referenceRepair, 'incident');
  it('ignores results/errors/exits after timeout and terminates only once', async () => {
    vi.useFakeTimers();
    const outcome = executeSimulation(bundle, 10).catch((error) => error as unknown);
    await vi.advanceTimersByTimeAsync(11);
    const worker = state.workers[0]!;
    worker.emit('message', runSimulation(bundle));
    worker.emit('error', new Error('late'));
    worker.emit('exit', 1);
    expect(await outcome).toMatchObject({
      code: 'INTERNAL',
      safeMessage: expect.stringContaining('timed out'),
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['message', 'error', 'exit'] as const)(
    'settles an invalid %s once and clears the deadline',
    async (event) => {
      vi.useFakeTimers();
      const outcome = executeSimulation(bundle, 100).catch((error) => error as unknown);
      await vi.advanceTimersByTimeAsync(0);
      const worker = state.workers[0]!;
      worker.emit(
        event,
        event === 'message' ? { invalid: true } : new Error('private worker detail'),
      );
      expect(await outcome).toMatchObject({ code: 'INTERNAL' });
      await vi.advanceTimersByTimeAsync(200);
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it('keeps a valid result when a late error follows it', async () => {
    vi.useFakeTimers();
    const result = runSimulation(bundle),
      outcome = executeSimulation(bundle, 100);
    await vi.advanceTimersByTimeAsync(0);
    const worker = state.workers[0]!;
    worker.emit('message', result);
    worker.emit('error', new Error('late'));
    worker.emit('exit', 0);
    expect(await outcome).toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
