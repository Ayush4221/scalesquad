import { AppError, PublicMatchView, requireUser, type EvidencePhase } from '@scalesquad/shared';
import { loadScenario, toPublicScenario } from '@scalesquad/scenario';
import { ENGINE_VERSION, compareRuns } from '@scalesquad/sim';
import type { ChatProvider } from '@scalesquad/nexconn';
import type {
  ChatReconciliation,
  GameRepository,
  MatchRecord,
  UserRepository,
} from '../domain/models';
import type { Clock, DomainEvents } from '../domain/ports';
import { audit, currentConfig, host, member, phase } from './guards';
import { canTransition } from './matchStateMachine';
import { assignRoles } from './roles';
import { ensureEvidence } from './evidenceService';
import { normalizeCode, uniqueJoinCode } from '../utils/joinCode';
import { runtimePolicy } from '../constants/runtimePolicy';
import { KeyedQueue } from '../utils/keyedQueue';
import { rateLimitsEnabled } from '../utils/rateLimit';
import { ChatReconciliationService } from './chatReconciliationService';

export class MatchService {
  private readonly creations = new KeyedQueue();
  // Keep lobby membership and upstream chat changes together before starting.
  private readonly memberships = new KeyedQueue();
  private readonly reconciliation: ChatReconciliationService;
  constructor(
    private readonly repo: GameRepository,
    private readonly users: UserRepository,
    private readonly chat: ChatProvider,
    private readonly clock: Clock,
    private readonly events: DomainEvents,
    private readonly id: () => string,
  ) {
    this.reconciliation = new ChatReconciliationService(repo, chat, clock, this.memberships);
  }
  reconcileChat() {
    return this.reconciliation.sweep();
  }
  async createMatch(userId: string | null, scenarioId = 'campuspass') {
    requireUser(userId);
    loadScenario(scenarioId);
    return this.creations.run(userId, async () => {
      if ((await this.repo.countMemberships(userId)) >= runtimePolicy.maxActiveMembershipsPerUser)
        throw new AppError('RATE_LIMITED', 429, 'Match limit reached');
      const counts = await this.repo.countHosted(userId, this.clock.now() - 86400000);
      if (
        counts.active >= runtimePolicy.maxActiveMatchesPerHost ||
        (rateLimitsEnabled() && counts.recent >= runtimePolicy.maxMatchesPerDay)
      )
        throw new AppError('RATE_LIMITED', 429, 'Match creation limit reached');
      return this.createReservedMatch(userId, scenarioId);
    });
  }
  private async createReservedMatch(userId: string, scenarioId: string) {
    const user = await this.users.find(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 401);
    const s = loadScenario(scenarioId),
      id = this.id(),
      now = this.clock.now();
    const code = await uniqueJoinCode(async (c) => (await this.repo.findByCode(c)) !== null);
    const m: MatchRecord = {
      id,
      createdAt: now,
      joinCode: code,
      joinCodeExpiresAt: now + s.match.joinCodeTtlMs,
      hostUserId: userId,
      phase: 'LOBBY',
      scenarioVersion: s.scenarioVersion,
      scenarioId: s.scenarioId,
      engineVersion: ENGINE_VERSION,
      revision: 0,
      simulationLocked: false,
      deadlineAt: null,
      runStartedAt: null,
      runError: false,
      endedAt: null,
      members: [
        {
          ...user,
          role: assignRoles(id)[0] ?? 'TRAFFIC',
          ready: false,
          acknowledged: false,
          lastSeenAt: now,
          disconnectedAt: null,
        },
      ],
      configurations: [{ version: 0, values: s.presetConfiguration, createdByUserId: userId }],
      lock: null,
      runs: [],
      evidence: [],
      audit: [],
      groupRef: null,
      chatAvailable: false,
    };
    audit(m, userId, 'match.create');
    return this.memberships.run(id, async () => {
      let task: ChatReconciliation | null = null;
      try {
        // Journal the deterministic reference before an ambiguous remote response.
        if (this.chat.available) {
          const reference = this.chat.groupReference(id);
          task = await this.reconciliation.record(id, reference, null);
          m.groupRef = await this.chat.createGroup(id, [userId]);
          m.chatAvailable = true;
        }
        await this.repo.create(m);
      } catch (error) {
        // A failed insert may have committed. Re-read before deleting remote access.
        const committed = await this.repo.find(id).catch(() => null);
        if (committed?.hostUserId === userId && committed.joinCode === code) {
          if (task) await this.reconciliation.complete(task).catch(() => {});
          return this.publicView(committed, userId);
        }
        if (task) await this.reconciliation.settle(task).catch(() => {});
        throw error;
      }
      // If deletion fails, the durable intent is harmless: reconciliation keeps
      // the group owned by the committed match instead of provisioning it again.
      if (task) await this.reconciliation.complete(task).catch(() => {});
      return this.getPublicView(userId, id);
    });
  }
  async joinMatch(userId: string | null, rawCode: string) {
    requireUser(userId);
    return this.creations.run(userId, () => this.joinReservedMatch(userId, rawCode));
  }
  private async joinReservedMatch(userId: string, rawCode: string) {
    const user = await this.users.find(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 401);
    const found = await this.repo.findByCode(normalizeCode(rawCode));
    if (!found) throw new AppError('NOT_FOUND', 404, 'Invalid join code');
    return this.memberships.run(found.id, async () => {
      const current = await this.repo.find(found.id);
      if (!current) throw new AppError('NOT_FOUND', 404);
      phase(current, 'LOBBY');
      if (
        !current.members.some((m) => m.userId === userId) &&
        (await this.repo.countMemberships(userId)) >= runtimePolicy.maxActiveMembershipsPerUser
      )
        throw new AppError('RATE_LIMITED', 429, 'Match limit reached');
      const task = current.groupRef
        ? await this.reconciliation.record(found.id, current.groupRef, userId)
        : null;
      let added = false;
      await this.repo.mutate(found.id, (m) => {
        phase(m, 'LOBBY');
        if (m.joinCodeExpiresAt <= this.clock.now())
          throw new AppError('NOT_FOUND', 404, 'Join code expired');
        if (m.members.some((p) => p.userId === userId)) return;
        if (m.members.length >= 3) throw new AppError('CONFLICT', 409, 'Squad is full');
        const role = assignRoles(m.id).find((r) => !m.members.some((p) => p.role === r));
        if (!role) throw new AppError('CONFLICT', 409);
        m.members.push({
          ...user,
          role,
          ready: false,
          acknowledged: false,
          lastSeenAt: this.clock.now(),
          disconnectedAt: null,
        });
        added = true;
        audit(m, userId, 'match.join');
      });
      if (current.groupRef) {
        try {
          await this.chat.addMember(current.groupRef, userId);
        } catch (error) {
          if (added) {
            // A timed-out response may still have added the upstream member. Only
            // release the local membership after chat access is confirmed removed.
            let removed = false;
            try {
              await this.chat.removeMember(current.groupRef, userId);
              removed = true;
            } catch {
              /* Keep the reservation so upstream access still has an owner. */
            }
            await this.repo.mutate(found.id, (m) => {
              if (removed) m.members = m.members.filter((p) => p.userId !== userId);
              else {
                const pending = m.members.find((p) => p.userId === userId);
                if (pending) pending.ready = false;
              }
            });
            this.events.changed(found.id);
          }
          throw error;
        }
      }
      if (task) await this.reconciliation.complete(task).catch(() => {});
      this.events.changed(found.id);
      return this.getPublicView(userId, found.id);
    });
  }
  async setReady(userId: string | null, id: string, ready: boolean) {
    await this.memberships.run(id, async () => {
      // Authorize before inspecting or repairing another account's journal.
      const current = await this.repo.find(id);
      if (!current) throw new AppError('NOT_FOUND', 404);
      member(current, userId);
      phase(current, 'LOBBY');
      if (ready) await this.reconciliation.member(id, userId!);
      await this.repo.mutate(id, (m) => {
        const user = member(m, userId);
        phase(m, 'LOBBY');
        user.ready = ready;
      });
    });
    this.events.changed(id);
  }
  async startMatch(userId: string | null, id: string) {
    await this.memberships.run(id, async () => {
      const current = await this.repo.find(id);
      if (!current) throw new AppError('NOT_FOUND', 404);
      host(current, userId);
      phase(current, 'LOBBY');
      for (const user of current.members) await this.reconciliation.member(id, user.userId);
      await this.repo.mutate(id, (m) => {
        host(m, userId);
        phase(m, 'LOBBY');
        this.transition(m, 'BRIEFING');
        audit(m, userId!, 'match.start');
      });
    });
    await this.notifyPhase(id, 'BRIEFING');
  }
  private transition(m: MatchRecord, to: MatchRecord['phase'], timerElapsed = false) {
    if (!canTransition(m.phase, to, { members: m.members, timerElapsed }))
      throw new AppError('PHASE_INVALID', 409, 'Squad is not ready');
    m.phase = to;
    const s = loadScenario(m.scenarioId, m.scenarioVersion),
      now = this.clock.now();
    m.deadlineAt =
      to === 'BRIEFING'
        ? now + s.match.briefDurationMs
        : to === 'INCIDENT_EVIDENCE'
          ? now + s.match.incidentDurationMs
          : to === 'COMPARE'
            ? now + s.match.compareDurationMs
            : null;
    m.members.forEach((p) => {
      p.acknowledged = false;
    });
    if (to === 'BRIEFING' || to === 'INCIDENT_EVIDENCE') ensureEvidence(m, to);
    if (to === 'REPAIR_1' || to === 'REPAIR_2')
      m.lock = {
        holderUserId: m.hostUserId,
        expiresAt: now + s.match.lockLeaseMs,
        configurationVersion: currentConfig(m).version,
      };
    if (to === 'FINISHED') m.endedAt = now;
  }
  async acknowledge(userId: string | null, id: string) {
    await this.repo.mutate(id, (m) => {
      const u = member(m, userId);
      phase(m, 'BRIEFING', 'INCIDENT_EVIDENCE');
      u.acknowledged = true;
      if (m.members.every((p) => p.acknowledged))
        this.transition(m, m.phase === 'BRIEFING' ? 'REPAIR_1' : 'REPAIR_2');
    });
    this.events.changed(id);
  }
  async advance(userId: string | null, id: string) {
    let evidence: EvidencePhase | null = null;
    await this.repo.mutate(id, (m) => {
      host(m, userId);
      phase(m, 'RUNS_1_2', 'COMPARE');
      if (m.simulationLocked || (m.phase === 'RUNS_1_2' && m.runs.length < 2))
        throw new AppError('CONFLICT', 409);
      const to = m.phase === 'RUNS_1_2' ? 'INCIDENT_EVIDENCE' : 'FINISHED';
      this.transition(m, to);
      if (to === 'INCIDENT_EVIDENCE') evidence = to;
      audit(m, userId!, 'match.advance');
    });
    await this.notifyPhase(id, evidence);
  }
  async expire(id: string) {
    let evidence: EvidencePhase | null = null;
    await this.repo.mutate(id, (m) => {
      if (m.deadlineAt === null || m.deadlineAt > this.clock.now() || m.simulationLocked) return;
      const to =
        m.phase === 'BRIEFING'
          ? 'REPAIR_1'
          : m.phase === 'INCIDENT_EVIDENCE'
            ? 'REPAIR_2'
            : m.phase === 'RUNS_1_2'
              ? 'INCIDENT_EVIDENCE'
              : m.phase === 'COMPARE'
                ? 'FINISHED'
                : null;
      if (to) {
        this.transition(m, to, true);
        if (to === 'INCIDENT_EVIDENCE') evidence = to;
      }
    });
    await this.notifyPhase(id, evidence);
  }
  private async notifyPhase(id: string, evidence: EvidencePhase | null) {
    const m = await this.repo.find(id);
    if (!m) return;
    this.events.changed(id);
    if (evidence) m.members.forEach((u) => this.events.evidenceAvailable(id, u.userId, evidence));
    if (evidence === 'BRIEFING' || m.phase === 'FINISHED')
      for (const u of m.members)
        this.events.notification?.(
          u.userId,
          m.phase === 'FINISHED' ? 'MATCH_FINISHED' : 'MATCH_STARTED',
          id,
        );
    if (m.groupRef)
      await this.chat.sendSystemNotice(m.groupRef, `Phase: ${m.phase}`).catch(() => {});
  }
  async leaveMatch(userId: string | null, id: string) {
    return this.memberships.run(id, async () => {
      const m = await this.repo.find(id);
      if (!m) throw new AppError('NOT_FOUND', 404);
      member(m, userId);
      phase(m, 'LOBBY');
      if (m.hostUserId === userId)
        throw new AppError('FORBIDDEN', 403, 'The host must stay in the lobby');
      const task = m.groupRef ? await this.reconciliation.record(id, m.groupRef, userId!) : null;
      if (m.groupRef) await this.chat.removeMember(m.groupRef, userId!);
      try {
        await this.repo.mutate(id, (current) => {
          member(current, userId);
          phase(current, 'LOBBY');
          current.members = current.members.filter((u) => u.userId !== userId);
          audit(current, userId!, 'match.leave');
        });
      } catch (error) {
        // Reconcile against persisted membership, including an ambiguous commit.
        if (task) await this.reconciliation.settle(task).catch(() => {});
        const committed = await this.repo.find(id).catch(() => null);
        if (!committed || committed.members.some((user) => user.userId === userId)) throw error;
      }
      if (task) await this.reconciliation.complete(task).catch(() => {});
      this.events.changed(id);
    });
  }
  async getPublicView(userId: string | null, id: string): Promise<PublicMatchView> {
    requireUser(userId);
    const m = await this.repo.find(id);
    if (!m) throw new AppError('NOT_FOUND', 404);
    return this.publicView(m, userId);
  }
  /** Internal fan-out: load once and retain each recipient's own-role projection. */
  async getPublicViews(userIds: readonly string[], id: string) {
    const m = await this.repo.find(id);
    const views = new Map<string, PublicMatchView>();
    if (!m) return views;
    for (const userId of new Set(userIds))
      if (m.members.some((entry) => entry.userId === userId))
        views.set(userId, this.publicView(m, userId));
    return views;
  }
  async memberIds(id: string): Promise<ReadonlySet<string>> {
    const m = await this.repo.find(id);
    return new Set(m?.members.map((entry) => entry.userId));
  }
  private publicView(m: MatchRecord, userId: string): PublicMatchView {
    const own = member(m, userId);
    const run2 = m.runs.find((r) => r.runNumber === 2),
      run3 = m.runs.find((r) => r.runNumber === 3),
      config = currentConfig(m);
    return PublicMatchView.parse({
      id: m.id,
      revision: m.revision,
      hostUserId: m.hostUserId,
      phase: m.phase,
      joinCode: m.phase === 'LOBBY' ? m.joinCode : null,
      deadlineAt: m.deadlineAt,
      simulationLocked: m.simulationLocked,
      members: m.members.map((u) => ({
        userId: u.userId,
        name: u.name,
        ready: u.ready,
        acknowledged: u.acknowledged,
        role: m.phase === 'LOBBY' ? null : u.role,
      })),
      ownRole: m.phase === 'LOBBY' ? null : own.role,
      configuration: { version: config.version, values: config.values },
      lock: m.lock ? { holderUserId: m.lock.holderUserId, expiresAt: m.lock.expiresAt } : null,
      scenario: toPublicScenario(loadScenario(m.scenarioId, m.scenarioVersion)),
      runs: m.runs
        .map((r) => ({ runNumber: r.runNumber, result: r.result }))
        .sort((a, b) => a.runNumber - b.runNumber),
      comparison: run2 && run3 ? compareRuns(run2.result, run3.result) : null,
      chatAvailable: m.chatAvailable,
      runError: m.runError,
    });
  }
  async chatToken(userId: string | null, id: string) {
    requireUser(userId);
    const m = await this.repo.find(id);
    if (!m) throw new AppError('NOT_FOUND', 404);
    member(m, userId);
    if (!m.groupRef) throw new AppError('UPSTREAM_UNAVAILABLE', 503, 'Chat is unavailable');
    const access = await this.chat.mintUserToken(userId);
    // Explicit public response: never serialize additional provider fields.
    return {
      token: access.token,
      appKey: access.appKey,
      region: access.region,
      groupRef: m.groupRef,
    };
  }
}
