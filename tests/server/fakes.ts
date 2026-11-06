import { AppError } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import { runSimulation } from '@scalesquad/sim';
import { FakeChatProvider } from '@scalesquad/nexconn/fake';
import type { GameRepository, MatchRecord, UserRepository } from '../../src/server/lib/models';
import { silentEvents, type DomainEvents } from '../../src/server/lib/ports';
import { MatchService } from '../../src/server/services/matchService';
import { ConfigService } from '../../src/server/services/configService';
import { EditLockService } from '../../src/server/services/editLockService';
import { EvidenceService } from '../../src/server/services/evidenceService';
import { RunService } from '../../src/server/services/runService';
export class MemoryRepository implements GameRepository {
  readonly data = new Map<string, MatchRecord>();
  private chain = Promise.resolve();
  async create(m: MatchRecord) {
    if ([...this.data.values()].some((r) => r.joinCode === m.joinCode))
      throw new AppError('CONFLICT', 409);
    this.data.set(m.id, structuredClone(m));
  }
  async find(id: string) {
    const m = this.data.get(id);
    return m ? structuredClone(m) : null;
  }
  async findByCode(code: string) {
    const m = [...this.data.values()].find((r) => r.joinCode === code);
    return m ? structuredClone(m) : null;
  }
  async active() {
    return [...this.data.values()]
      .filter((m) => m.phase !== 'FINISHED')
      .map((m) => structuredClone(m));
  }
  async dueIds(now: number, limit: number) {
    return [...this.data.values()]
      .filter(
        (m) =>
          m.phase !== 'FINISHED' &&
          !m.simulationLocked &&
          m.deadlineAt !== null &&
          m.deadlineAt <= now,
      )
      .slice(0, limit)
      .map((m) => m.id);
  }
  async inactiveIds(before: number, limit: number) {
    return [...this.data.values()]
      .filter(
        (m) =>
          m.createdAt < before &&
          m.phase !== 'FINISHED' &&
          !m.simulationLocked &&
          m.members.every((u) => u.lastSeenAt < before),
      )
      .slice(0, limit)
      .map((m) => m.id);
  }
  async countHosted(userId: string, since: number) {
    const matches = [...this.data.values()].filter((m) => m.hostUserId === userId);
    return {
      active: matches.filter((m) => m.phase !== 'FINISHED' || m.groupRef !== null).length,
      recent: matches.filter((m) => m.createdAt >= since).length,
    };
  }
  async countMemberships(userId: string) {
    return [...this.data.values()].filter(
      (m) => m.phase !== 'FINISHED' && m.members.some((u) => u.userId === userId),
    ).length;
  }
  async presenceState(id: string, userId: string) {
    const m = this.data.get(id);
    return m?.members.some((u) => u.userId === userId)
      ? {
          scenarioId: m.scenarioId,
          scenarioVersion: m.scenarioVersion,
          phase: m.phase,
          simulationLocked: m.simulationLocked,
          lock: structuredClone(m.lock),
        }
      : null;
  }
  async recordPresence(
    id: string,
    userId: string,
    now: number,
    connected: boolean,
    renewUntil: number | null,
  ) {
    const m = this.data.get(id),
      u = m?.members.find((u) => u.userId === userId);
    if (!m || !u) return;
    u.lastSeenAt = now;
    u.disconnectedAt = connected ? null : now;
    if (
      renewUntil !== null &&
      m.lock?.holderUserId === userId &&
      m.lock.expiresAt > now &&
      !m.simulationLocked &&
      ['REPAIR_1', 'REPAIR_2'].includes(m.phase)
    )
      m.lock.expiresAt = renewUntil;
  }
  async closeInactive(id: string, before: number, now: number) {
    const m = this.data.get(id);
    if (
      !m ||
      m.phase === 'FINISHED' ||
      m.simulationLocked ||
      m.members.some((u) => u.lastSeenAt >= before)
    )
      return false;
    m.phase = 'FINISHED';
    m.endedAt = now;
    m.deadlineAt = null;
    m.revision++;
    return true;
  }
  async finishedGroups(limit: number) {
    return [...this.data.values()]
      .filter((m) => m.phase === 'FINISHED' && m.groupRef !== null)
      .slice(0, limit)
      .map((m) => ({ id: m.id, groupRef: m.groupRef! }));
  }
  async clearGroup(id: string, groupRef: string) {
    const m = this.data.get(id);
    if (m?.groupRef === groupRef) {
      m.groupRef = null;
      m.chatAvailable = false;
      m.revision++;
    }
  }
  async mutate<T>(id: string, fn: (m: MatchRecord) => T): Promise<T> {
    let result: T;
    const task = this.chain.then(() => {
      const m = this.data.get(id);
      if (!m) throw new AppError('NOT_FOUND', 404);
      const copy = structuredClone(m);
      result = fn(copy);
      copy.revision++;
      this.data.set(id, copy);
    });
    this.chain = task.catch(() => {});
    await task;
    return result!;
  }
  async delete(id: string) {
    this.data.delete(id);
  }
  async listForOwner(matchId: string, userId: string) {
    return (this.data.get(matchId)?.evidence ?? [])
      .filter((e) => e.userId === userId)
      .map((e) => structuredClone(e.card));
  }
}
export function fixture(events: DomainEvents = silentEvents) {
  const repo = new MemoryRepository(),
    chat = new FakeChatProvider(),
    clock = {
      value: 1000,
      now() {
        return this.value;
      },
    };
  const users: UserRepository = {
    async find(id) {
      return ['a', 'b', 'c', 'd'].includes(id)
        ? { userId: id, name: `Player ${id}`, emailVerified: true }
        : null;
    },
  };
  let id = 0;
  const match = new MatchService(repo, users, chat, clock, events, () => `match${++id}`);
  const config = new ConfigService(repo, clock, events),
    lock = new EditLockService(repo, clock, events),
    evidence = new EvidenceService(repo, repo);
  const run = new RunService(repo, clock, events, async (b) => runSimulation(b));
  const services = { match, config, lock, evidence, run };
  async function lobby() {
    const m = await match.createMatch('a');
    await match.joinMatch('b', m.joinCode!);
    await match.joinMatch('c', m.joinCode!);
    return m.id;
  }
  async function briefing() {
    const id = await lobby();
    for (const u of ['a', 'b', 'c']) await match.setReady(u, id, true);
    await match.startMatch('a', id);
    return id;
  }
  async function repair() {
    const id = await briefing();
    for (const u of ['a', 'b', 'c']) await match.acknowledge(u, id);
    return id;
  }
  return {
    repo,
    chat,
    clock,
    users,
    ...services,
    services,
    lobby,
    briefing,
    repair,
    scenario: loadScenario(),
  };
}
