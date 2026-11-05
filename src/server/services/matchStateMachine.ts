import { Role, type MatchPhase } from '@scalesquad/shared';
import type { Member } from '../lib/models';
const transitions: Partial<Record<MatchPhase, MatchPhase>> = {
  LOBBY: 'BRIEFING',
  BRIEFING: 'REPAIR_1',
  REPAIR_1: 'RUNS_1_2',
  RUNS_1_2: 'INCIDENT_EVIDENCE',
  INCIDENT_EVIDENCE: 'REPAIR_2',
  REPAIR_2: 'RUN_3',
  RUN_3: 'COMPARE',
  COMPARE: 'FINISHED',
};
export function canTransition(
  from: MatchPhase,
  to: MatchPhase,
  context: { members: Member[]; timerElapsed?: boolean },
): boolean {
  if (transitions[from] !== to) return false;
  if (from === 'LOBBY')
    return (
      context.members.length === 3 &&
      Role.options.every((role) => context.members.some((m) => m.role === role && m.ready))
    );
  if (from === 'BRIEFING' || from === 'INCIDENT_EVIDENCE')
    return context.timerElapsed === true || context.members.every((m) => m.acknowledged);
  return true;
}
