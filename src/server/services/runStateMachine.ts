import { AppError } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import type { MatchRecord } from '../domain/models';
import { phase } from './guards';

export type RunStage = 1 | 3;
export const repairPhase = (stage: RunStage) => (stage === 1 ? 'REPAIR_1' : 'REPAIR_2');
export const runningPhase = (stage: RunStage) => (stage === 1 ? 'RUNS_1_2' : 'RUN_3');
export function runsCompleted(match: MatchRecord, stage: RunStage): boolean {
  return (stage === 1 ? [1, 2] : [3]).every((number) =>
    match.runs.some((run) => run.runNumber === number),
  );
}
export function beginRun(match: MatchRecord, stage: RunStage, now: number): void {
  phase(match, repairPhase(stage));
  if (match.simulationLocked) throw new AppError('CONFLICT', 409);
  match.phase = runningPhase(stage);
  match.simulationLocked = true;
  match.runStartedAt = now;
  match.runError = false;
  match.deadlineAt = null;
}
/** Shared by successful execution, final-save recovery, and process restart. */
export function settleRun(match: MatchRecord, stage: RunStage, now: number): boolean {
  phase(match, runningPhase(stage), repairPhase(stage));
  const completed = runsCompleted(match, stage);
  match.simulationLocked = false;
  match.runStartedAt = null;
  match.runError = !completed;
  if (completed) {
    const scenario = loadScenario(match.scenarioId, match.scenarioVersion);
    match.phase = stage === 3 ? 'COMPARE' : 'RUNS_1_2';
    match.deadlineAt =
      now + (stage === 3 ? scenario.match.compareDurationMs : scenario.match.incidentDurationMs);
  } else {
    match.phase = repairPhase(stage);
    match.deadlineAt = null;
  }
  return completed;
}
