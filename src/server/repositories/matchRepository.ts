import { getPrisma, type Prisma } from '@scalesquad/db';
import {
  AppError,
  ConfigurationValues,
  EvidenceCard,
  SimulationResult,
  RunNumber,
  type EvidencePhase,
} from '@scalesquad/shared';
import type { ChatReconciliation, GameRepository, MatchRecord } from '../domain/models';
import { withTransaction } from './unitOfWork';

const include = {
  members: { include: { user: { select: { name: true } } } },
  configurations: { orderBy: { version: 'asc' as const } },
  editLock: true,
  runs: true,
  evidence: true,
  audit: true,
  nexconn: true,
};
type Row = Prisma.MatchGetPayload<{ include: typeof include }>;
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function mapMatch(row: Row): MatchRecord {
  return {
    id: row.id,
    createdAt: row.createdAt.getTime(),
    joinCode: row.joinCode,
    joinCodeExpiresAt: row.joinCodeExpiresAt.getTime(),
    hostUserId: row.hostUserId,
    phase: row.phase,
    scenarioVersion: row.scenarioVersion,
    scenarioId: row.scenarioId,
    engineVersion: row.engineVersion,
    revision: row.revision,
    simulationLocked: row.simulationLocked,
    deadlineAt: row.deadlineAt?.getTime() ?? null,
    runStartedAt: row.runStartedAt?.getTime() ?? null,
    runError: row.runError,
    endedAt: row.endedAt?.getTime() ?? null,
    members: row.members.map((m) => ({
      userId: m.userId,
      name: m.user.name ?? 'Player',
      role: m.role,
      ready: m.ready,
      acknowledged: m.acknowledged,
      lastSeenAt: m.lastSeenAt.getTime(),
      disconnectedAt: m.disconnectedAt?.getTime() ?? null,
    })),
    configurations: row.configurations.map((c) => ({
      version: c.version,
      values: ConfigurationValues.parse(c.values),
      createdByUserId: c.createdByUserId,
    })),
    lock: row.editLock
      ? {
          holderUserId: row.editLock.holderUserId,
          expiresAt: row.editLock.expiresAt.getTime(),
          configurationVersion: row.editLock.configurationVersion,
        }
      : null,
    runs: row.runs.map((r) => ({
      runNumber: RunNumber.parse(r.runNumber),
      configurationVersion: r.configurationVersion,
      snapshotHash: r.snapshotId,
      input: r.input,
      result: SimulationResult.parse(r.result),
    })),
    evidence: row.evidence.map((e) => ({
      userId: e.userId,
      phase: e.phase as EvidencePhase,
      card: EvidenceCard.parse(e.payload),
    })),
    audit: row.audit.map((a) => ({
      id: a.id,
      userId: a.userId,
      action: a.action,
      detail: a.detail as Record<string, string | number | boolean>,
    })),
    groupRef: row.nexconn?.groupChannelRef ?? null,
    chatAvailable: row.nexconn !== null,
  };
}
async function saveChildren(tx: Prisma.TransactionClient, m: MatchRecord) {
  await tx.matchMember.deleteMany({
    where: { matchId: m.id, userId: { notIn: m.members.map((u) => u.userId) } },
  });
  for (const u of m.members) {
    const data = {
      role: u.role,
      ready: u.ready,
      acknowledged: u.acknowledged,
      lastSeenAt: new Date(u.lastSeenAt),
      disconnectedAt: u.disconnectedAt === null ? null : new Date(u.disconnectedAt),
    };
    await tx.matchMember.upsert({
      where: { matchId_userId: { matchId: m.id, userId: u.userId } },
      create: { id: `${m.id}_${u.userId}`, matchId: m.id, userId: u.userId, ...data },
      update: { role: u.role, ready: u.ready, acknowledged: u.acknowledged },
    });
  }
  for (const c of m.configurations)
    await tx.configuration.upsert({
      where: { matchId_version: { matchId: m.id, version: c.version } },
      create: {
        id: `${m.id}_${c.version}`,
        matchId: m.id,
        version: c.version,
        values: json(c.values),
        createdByUserId: c.createdByUserId,
      },
      update: {},
    });
  if (m.lock)
    await tx.editLock.upsert({
      where: { matchId: m.id },
      create: { matchId: m.id, ...m.lock, expiresAt: new Date(m.lock.expiresAt) },
      update: { ...m.lock, expiresAt: new Date(m.lock.expiresAt) },
    });
  else await tx.editLock.deleteMany({ where: { matchId: m.id } });
  for (const r of m.runs) {
    const input = r.input as {
      configuration: unknown;
      incidentProfileId: string;
      trafficProfileId: string;
      scenario: { profiles: Record<string, { version: string }> };
    };
    await tx.configurationSnapshot.upsert({
      where: { contentHash: r.snapshotHash },
      create: {
        id: r.snapshotHash,
        contentHash: r.snapshotHash,
        values: json(input.configuration),
      },
      update: {},
    });
    await tx.simulationRun.upsert({
      where: { matchId_runNumber: { matchId: m.id, runNumber: r.runNumber } },
      create: {
        id: `${m.id}_${r.runNumber}`,
        matchId: m.id,
        runNumber: r.runNumber,
        snapshotId: r.snapshotHash,
        configurationVersion: r.configurationVersion,
        inputHash: r.result.inputHash,
        sharedInputHash: r.result.sharedInputHash,
        incidentVersion: input.scenario.profiles[input.incidentProfileId]?.version ?? '',
        trafficProfileId: input.trafficProfileId,
        engineVersion: r.result.engineVersion,
        scenarioVersion: r.result.scenarioVersion,
        input: json(r.input),
        result: json(r.result),
      },
      update: {},
    });
  }
  for (const e of m.evidence)
    await tx.privateEvidence.upsert({
      where: { matchId_userId_phase: { matchId: m.id, userId: e.userId, phase: e.phase } },
      create: {
        id: `${m.id}_${e.userId}_${e.phase}`,
        matchId: m.id,
        userId: e.userId,
        phase: e.phase,
        payload: json(e.card),
      },
      update: {},
    });
  for (const a of m.audit)
    await tx.auditLog.upsert({
      where: { id: a.id },
      create: { ...a, matchId: m.id, detail: json(a.detail) },
      update: {},
    });
  if (m.groupRef)
    await tx.nexconnMapping.upsert({
      where: { matchId: m.id },
      create: {
        matchId: m.id,
        groupChannelRef: m.groupRef,
        userRefs: json(m.members.map((u) => u.userId)),
      },
      update: { userRefs: json(m.members.map((u) => u.userId)) },
    });
}
const fields = (m: MatchRecord) => ({
  phase: m.phase,
  simulationLocked: m.simulationLocked,
  deadlineAt: m.deadlineAt === null ? null : new Date(m.deadlineAt),
  runStartedAt: m.runStartedAt === null ? null : new Date(m.runStartedAt),
  runError: m.runError,
  endedAt: m.endedAt === null ? null : new Date(m.endedAt),
});
export class PrismaMatchRepository implements GameRepository {
  constructor(private readonly client = getPrisma()) {}
  async saveChatTask(task: ChatReconciliation) {
    const data = { ...task, retryAt: new Date(task.retryAt) };
    await this.client.chatReconciliation.upsert({
      where: { id: task.id },
      create: data,
      update: data,
    });
  }
  async findChatTask(id: string) {
    const task = await this.client.chatReconciliation.findUnique({ where: { id } });
    return task ? { ...task, retryAt: task.retryAt.getTime() } : null;
  }
  async pendingChatTasks(now: number, limit: number) {
    const tasks = await this.client.chatReconciliation.findMany({
      where: { retryAt: { lte: new Date(now) } },
      orderBy: [{ retryAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return tasks.map((task) => ({ ...task, retryAt: task.retryAt.getTime() }));
  }
  async completeChatTask(id: string, version: string) {
    await this.client.chatReconciliation.deleteMany({ where: { id, version } });
  }
  async deferChatTask(id: string, version: string, retryAt: number) {
    await this.client.chatReconciliation.updateMany({
      where: { id, version },
      data: { retryAt: new Date(retryAt) },
    });
  }
  async create(m: MatchRecord) {
    await withTransaction(async (tx) => {
      await tx.match.create({
        data: {
          id: m.id,
          createdAt: new Date(m.createdAt),
          joinCode: m.joinCode,
          joinCodeExpiresAt: new Date(m.joinCodeExpiresAt),
          hostUserId: m.hostUserId,
          scenarioVersion: m.scenarioVersion,
          scenarioId: m.scenarioId,
          engineVersion: m.engineVersion,
          ...fields(m),
        },
      });
      await saveChildren(tx, m);
    }, this.client);
  }
  async find(id: string) {
    const row = await this.client.match.findUnique({ where: { id }, include });
    return row ? mapMatch(row) : null;
  }
  async findByCode(joinCode: string) {
    const row = await this.client.match.findUnique({ where: { joinCode }, include });
    return row ? mapMatch(row) : null;
  }
  async active() {
    return (
      await this.client.match.findMany({ where: { phase: { not: 'FINISHED' } }, include })
    ).map(mapMatch);
  }
  async dueIds(now: number, limit: number) {
    return (
      await this.client.match.findMany({
        where: {
          phase: { not: 'FINISHED' },
          simulationLocked: false,
          deadlineAt: { lte: new Date(now) },
        },
        select: { id: true },
        orderBy: { deadlineAt: 'asc' },
        take: limit,
      })
    ).map((m) => m.id);
  }
  async inactiveIds(before: number, limit: number) {
    return (
      await this.client.match.findMany({
        where: {
          phase: { not: 'FINISHED' },
          simulationLocked: false,
          createdAt: { lt: new Date(before) },
          members: { none: { lastSeenAt: { gte: new Date(before) } } },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })
    ).map((m) => m.id);
  }
  async countHosted(userId: string, since: number) {
    const [active, recent] = await Promise.all([
      this.client.match.count({
        where: {
          hostUserId: userId,
          OR: [{ phase: { not: 'FINISHED' } }, { nexconn: { isNot: null } }],
        },
      }),
      this.client.match.count({
        where: { hostUserId: userId, createdAt: { gte: new Date(since) } },
      }),
    ]);
    return { active, recent };
  }
  async countMemberships(userId: string) {
    return this.client.matchMember.count({
      where: { userId, match: { phase: { not: 'FINISHED' } } },
    });
  }
  async presenceState(matchId: string, userId: string) {
    const row = await this.client.matchMember.findUnique({
      where: { matchId_userId: { matchId, userId } },
      select: {
        match: {
          select: {
            scenarioId: true,
            scenarioVersion: true,
            phase: true,
            simulationLocked: true,
            editLock: true,
          },
        },
      },
    });
    if (!row) return null;
    const m = row.match;
    return {
      scenarioId: m.scenarioId,
      scenarioVersion: m.scenarioVersion,
      phase: m.phase,
      simulationLocked: m.simulationLocked,
      lock: m.editLock
        ? {
            holderUserId: m.editLock.holderUserId,
            expiresAt: m.editLock.expiresAt.getTime(),
            configurationVersion: m.editLock.configurationVersion,
          }
        : null,
    };
  }
  async recordPresence(
    matchId: string,
    userId: string,
    now: number,
    connected: boolean,
    renewUntil: number | null,
  ) {
    const operations = [
      this.client.matchMember.updateMany({
        where: { matchId, userId },
        data: { lastSeenAt: new Date(now), disconnectedAt: connected ? null : new Date(now) },
      }),
    ];
    if (renewUntil !== null)
      operations.push(
        this.client.editLock.updateMany({
          where: {
            matchId,
            holderUserId: userId,
            expiresAt: { gt: new Date(now) },
            match: { phase: { in: ['REPAIR_1', 'REPAIR_2'] }, simulationLocked: false },
          },
          data: { expiresAt: new Date(renewUntil) },
        }),
      );
    await this.client.$transaction(operations);
  }
  async closeInactive(matchId: string, before: number, now: number) {
    const result = await this.client.match.updateMany({
      where: {
        id: matchId,
        phase: { not: 'FINISHED' },
        simulationLocked: false,
        members: { none: { lastSeenAt: { gte: new Date(before) } } },
      },
      data: {
        phase: 'FINISHED',
        endedAt: new Date(now),
        deadlineAt: null,
        revision: { increment: 1 },
      },
    });
    return result.count === 1;
  }
  async clearGroup(matchId: string, groupRef: string) {
    await this.client.$transaction([
      this.client.nexconnMapping.deleteMany({ where: { matchId, groupChannelRef: groupRef } }),
      this.client.match.updateMany({
        where: { id: matchId },
        data: { revision: { increment: 1 } },
      }),
    ]);
  }
  async finishedGroups(limit: number) {
    return (
      await this.client.nexconnMapping.findMany({
        where: { match: { phase: 'FINISHED' } },
        select: { matchId: true, groupChannelRef: true },
        take: limit,
      })
    ).map((row) => ({ id: row.matchId, groupRef: row.groupChannelRef }));
  }
  async mutate<T>(id: string, fn: (m: MatchRecord) => T): Promise<T> {
    return withTransaction(async (tx) => {
      const row = await tx.match.findUnique({ where: { id }, include });
      if (!row) throw new AppError('NOT_FOUND', 404);
      const m = mapMatch(row);
      const result = fn(m);
      const changed = await tx.match.updateMany({
        where: { id, revision: row.revision },
        data: { ...fields(m), revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw new AppError('VERSION_CONFLICT', 409);
      await saveChildren(tx, m);
      return result;
    }, this.client);
  }
  async delete(id: string) {
    await this.client.match.delete({ where: { id } });
  }
}
