import type { EvidencePhase, RunNumber, SimulationResult } from '@scalesquad/shared';
import type { PushMessageDto } from '@scalesquad/shared';
export interface DomainEvents {
  notification?(userId: string, kind: PushMessageDto['kind'], matchId: string): void;
  changed(matchId: string): void;
  evidenceAvailable(matchId: string, userId: string, phase: EvidencePhase): void;
  runStarted(matchId: string, runNumber: RunNumber): void;
  runCompleted(matchId: string, runNumber: RunNumber, result: SimulationResult): void;
}
export const silentEvents: DomainEvents = {
  changed() {},
  evidenceAvailable() {},
  runStarted() {},
  runCompleted() {},
};
export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };
