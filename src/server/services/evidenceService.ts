import { buildEvidenceCard, loadScenario } from '@scalesquad/scenario';
import { AppError, MatchPhase, requireUser, type EvidencePhase } from '@scalesquad/shared';
import type { GameRepository, EvidenceRepository, MatchRecord } from '../lib/models';
import { member } from './guards';
export function ensureEvidence(m: MatchRecord, phase: EvidencePhase) {
  const s = loadScenario(m.scenarioId, m.scenarioVersion);
  for (const user of m.members)
    if (!m.evidence.some((e) => e.userId === user.userId && e.phase === phase)) {
      m.evidence.push({ userId: user.userId, phase, card: buildEvidenceCard(user.role, phase, s) });
    }
}
export class EvidenceService {
  constructor(
    private readonly repo: GameRepository,
    private readonly evidence: EvidenceRepository,
  ) {}
  async get(userId: string | null, matchId: string) {
    requireUser(userId);
    const m = await this.repo.find(matchId);
    if (!m) {
      throw new AppError('NOT_FOUND', 404);
    }
    member(m, userId);
    return (await this.evidence.listForOwner(matchId, userId)).filter(
      (e) => MatchPhase.options.indexOf(e.phase) <= MatchPhase.options.indexOf(m.phase),
    );
  }
}
