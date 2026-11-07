import { afterEach, describe, expect, it, vi } from 'vitest';
const { compile } = vi.hoisted(() => ({ compile: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: compile }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  compile.mockReset();
});
describe('simulation compiler preparation', () => {
  it('shares in-flight work, retries a failed compilation, then caches success', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const callbacks: ((error: Error | null) => void)[] = [];
    compile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: unknown,
        callback: (error: Error | null) => void,
      ) => callbacks.push(callback),
    );
    const { prepareSimulationEngine } = await import('../../../src/server/infra/prepareSimulation');
    const first = prepareSimulationEngine();
    expect(prepareSimulationEngine()).toBe(first);
    const rejected = expect(first).rejects.toMatchObject({
      safeMessage: 'Simulation engine unavailable',
    });
    callbacks[0]!(new Error('compile failure'));
    await rejected;
    const retry = prepareSimulationEngine();
    expect(compile).toHaveBeenCalledTimes(2);
    callbacks[1]!(null);
    await retry;
    expect(prepareSimulationEngine()).toBe(retry);
    expect(compile).toHaveBeenCalledTimes(2);
  });
  it('uses production output without compiling', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { prepareSimulationEngine } = await import('../../../src/server/infra/prepareSimulation');
    await prepareSimulationEngine();
    expect(compile).not.toHaveBeenCalled();
  });
});
