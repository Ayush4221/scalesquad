import { AppError } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import type { GameRepository } from '../lib/models';
import type { Clock, DomainEvents } from '../lib/ports';
import { audit, currentConfig, editable, host, member, phase } from './guards';
export class EditLockService {
  constructor(
    private readonly repo: GameRepository,
    private readonly clock: Clock,
    private readonly events: DomainEvents,
  ) {}
  async passControl(userId: string | null, id: string, target: string) {
    await this.repo.mutate(id, (m) => {
      editable(m, userId, this.clock.now());
      member(m, target);
      m.lock = {
        holderUserId: target,
        expiresAt: this.clock.now() + loadScenario().match.lockLeaseMs,
        configurationVersion: currentConfig(m).version,
      };
      audit(m, userId!, 'lock.pass', { target });
    });
    this.events.changed(id);
    this.events.notification?.(target, 'LOCK_PASSED_TO_YOU', id);
  }
  async reclaim(userId: string | null, id: string) {
    await this.repo.mutate(id, (m) => {
      host(m, userId);
      phase(m, 'REPAIR_1', 'REPAIR_2');
      if (m.simulationLocked) throw new AppError('CONFLICT', 409);
      const holder = m.members.find((u) => u.userId === m.lock?.holderUserId),
        now = this.clock.now();
      const disconnected = holder?.disconnectedAt;
      if (
        m.lock &&
        m.lock.expiresAt > now &&
        (disconnected === null ||
          disconnected === undefined ||
          now - disconnected < loadScenario().match.reclaimAfterMs)
      )
        throw new AppError(
          'CONFLICT',
          409,
          'Editor is still connected or within the reclaim timeout',
        );
      m.lock = {
        holderUserId: userId!,
        expiresAt: now + loadScenario().match.lockLeaseMs,
        configurationVersion: currentConfig(m).version,
      };
      audit(m, userId!, 'lock.reclaim');
    });
    this.events.changed(id);
  }
  async presence(userId: string, id: string, connected: boolean) {
    const state = await this.repo.presenceState(id, userId);
    if (!state) throw new AppError('FORBIDDEN', 403);
    const now = this.clock.now();
    const renew =
      connected &&
      !state.simulationLocked &&
      ['REPAIR_1', 'REPAIR_2'].includes(state.phase) &&
      state.lock?.holderUserId === userId &&
      state.lock.expiresAt > now;
    await this.repo.recordPresence(
      id,
      userId,
      now,
      connected,
      renew ? now + loadScenario().match.lockLeaseMs : null,
    );
  }
}
