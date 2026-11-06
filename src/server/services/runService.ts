import { AppError, contentHash, type SimulationResult, type RunNumber } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import { assertComparable, InputBundleSchema, makeBundle, type InputBundle } from '@scalesquad/sim';
import type { GameRepository, MatchRecord } from '../lib/models';
import type { Clock, DomainEvents } from '../lib/ports';
import { audit, currentConfig, member, phase } from './guards';

export class RunService {
  private readonly inFlight = new Map<string, { runNumber: 1 | 3; job: Promise<void> }>();
  constructor(
    private readonly repo: GameRepository,
    private readonly clock: Clock,
    private readonly events: DomainEvents,
    private readonly execute: (bundle: InputBundle, timeoutMs: number) => Promise<SimulationResult>,
  ) {}
  async get(userId: string | null, id: string) {
    const m = await this.repo.find(id);
    if (!m) throw new AppError('NOT_FOUND', 404);
    member(m, userId);
    return m.runs
      .map((r) => ({ runNumber: r.runNumber, result: r.result }))
      .sort((a, b) => a.runNumber - b.runNumber);
  }
  async start(userId: string | null, id: string, runNumber: 1 | 3) {
    // Authorize even idempotent/concurrent requests before exposing any stored state.
    const m = await this.repo.find(id);
    if (!m) throw new AppError('NOT_FOUND', 404);
    this.authorizeRunner(m, userId);
    if (m.runs.some((r) => r.runNumber === (runNumber === 1 ? 2 : 3))) {
      // Also repair records left by an earlier restart after results were saved.
      const repairPhase = runNumber === 1 ? 'REPAIR_1' : 'REPAIR_2';
      if (!m.simulationLocked && m.phase === repairPhase) {
        await this.repo.mutate(id, (current) => {
          this.authorizeRunner(current, userId);
          if (!current.simulationLocked && current.phase === repairPhase)
            this.finish(current, runNumber);
        });
        this.events.changed(id);
      }
      return this.get(userId, id);
    }
    const existing = this.inFlight.get(id);
    if (existing) {
      if (existing.runNumber !== runNumber) throw new AppError('PHASE_INVALID', 409);
      await existing.job;
      return this.get(userId, id);
    }
    const job = this.perform(userId!, id, runNumber);
    this.inFlight.set(id, { runNumber, job });
    try {
      await job;
    } finally {
      this.inFlight.delete(id);
    }
    return this.get(userId, id);
  }
  private authorizeRunner(m: MatchRecord, userId: string | null) {
    member(m, userId);
    if (
      userId !== m.hostUserId &&
      !(userId === m.lock?.holderUserId && m.lock.expiresAt > this.clock.now())
    )
      throw new AppError('FORBIDDEN', 403);
  }
  private async perform(userId: string, id: string, runNumber: 1 | 3) {
    const bundles = await this.repo.mutate(id, (m) => {
      this.authorizeRunner(m, userId);
      phase(m, runNumber === 1 ? 'REPAIR_1' : 'REPAIR_2');
      if (m.simulationLocked) throw new AppError('CONFLICT', 409);
      const s = loadScenario('campuspass', m.scenarioVersion),
        config = currentConfig(m);
      const inputs =
        runNumber === 1
          ? [
              makeBundle(s, s.presetConfiguration, 'normal'),
              makeBundle(s, s.presetConfiguration, 'incident'),
            ]
          : [makeBundle(s, config.values, 'incident', config.version)];
      if (runNumber === 3) {
        const second = m.runs.find((r) => r.runNumber === 2);
        if (!second) throw new AppError('CONFLICT', 409);
        const previous = InputBundleSchema.parse(second.input);
        if (contentHash(previous) !== second.result.inputHash)
          throw new AppError('COMPARISON_INPUT_MISMATCH', 500);
        assertComparable(previous, inputs[0]!);
      }
      m.phase = runNumber === 1 ? 'RUNS_1_2' : 'RUN_3';
      m.simulationLocked = true;
      m.runStartedAt = this.clock.now();
      m.runError = false;
      m.deadlineAt = null;
      audit(m, userId, 'run.start', { runNumber, configurationVersion: config.version });
      return inputs;
    });
    this.events.changed(id);
    try {
      for (const [index, bundle] of bundles.entries()) {
        const n = (runNumber === 1 ? index + 1 : 3) as RunNumber;
        this.events.runStarted(id, n);
        const result = await this.execute(bundle, bundle.scenario.match.runTimeoutMs);
        if (result.inputHash !== contentHash(bundle)) throw new AppError('INTERNAL', 500);
        await this.repo.mutate(id, (m) => {
          if (!m.runs.some((r) => r.runNumber === n))
            m.runs.push({
              runNumber: n,
              configurationVersion: bundle.configurationVersion,
              snapshotHash: contentHash(bundle.configuration),
              input: bundle,
              result,
            });
        });
        this.events.runCompleted(id, n, result);
      }
      await this.repo.mutate(id, (m) => {
        this.finish(m, runNumber);
      });
      this.events.changed(id);
    } catch (error) {
      let completed = false;
      await this.repo.mutate(id, (m) => {
        completed = m.runs.some((r) => r.runNumber === (runNumber === 1 ? 2 : 3));
        if (completed) {
          this.finish(m, runNumber);
          return;
        }
        m.simulationLocked = false;
        m.runStartedAt = null;
        m.runError = true;
        m.phase = runNumber === 1 ? 'REPAIR_1' : 'REPAIR_2';
      });
      this.events.changed(id);
      if (completed) return;
      throw error instanceof AppError
        ? error
        : new AppError('INTERNAL', 500, 'Simulation failed; retry is available');
    }
  }
  private finish(m: MatchRecord, runNumber: 1 | 3) {
    const scenario = loadScenario('campuspass', m.scenarioVersion);
    m.simulationLocked = false;
    m.runStartedAt = null;
    m.runError = false;
    m.phase = runNumber === 3 ? 'COMPARE' : 'RUNS_1_2';
    m.deadlineAt =
      this.clock.now() +
      (runNumber === 3 ? scenario.match.compareDurationMs : scenario.match.incidentDurationMs);
  }
  async recover(m: MatchRecord) {
    if (!m.simulationLocked) return;
    await this.repo.mutate(m.id, (current) => {
      if (!current.simulationLocked) return;
      const runNumber = current.phase === 'RUN_3' ? 3 : 1;
      if (current.runs.some((r) => r.runNumber === (runNumber === 1 ? 2 : 3))) {
        this.finish(current, runNumber);
        return;
      }
      current.simulationLocked = false;
      current.runStartedAt = null;
      current.runError = true;
      current.phase = current.phase === 'RUN_3' ? 'REPAIR_2' : 'REPAIR_1';
    });
  }
}
