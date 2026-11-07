import { EvidenceCard } from '@scalesquad/shared';
import type { EvidenceRepository } from '../domain/models';
import { BaseRepository } from './baseRepository';
/** Ownership filtering happens in the database query, before any card is returned. */
export class PrismaEvidenceRepository extends BaseRepository implements EvidenceRepository {
  async listForOwner(matchId: string, userId: string) {
    const rows = await this.client.privateEvidence.findMany({
      where: { matchId, userId },
      select: { payload: true },
      orderBy: { deliveredAt: 'asc' },
    });
    return rows.map((row) => EvidenceCard.parse(row.payload));
  }
}
