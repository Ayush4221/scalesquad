import type { GameRepository } from '../domain/models';
import type { Clock, DomainEvents } from '../domain/ports';
import type { ChatProvider } from '@scalesquad/nexconn';
import { runtimePolicy } from '../constants/runtimePolicy';
export class MaintenanceService {
  constructor(
    private readonly repo: GameRepository,
    private readonly clock: Clock,
    private readonly events: DomainEvents,
    private readonly chat: ChatProvider,
  ) {}
  async due() {
    return this.repo.dueIds(this.clock.now(), runtimePolicy.maintenanceBatch);
  }
  async sweep() {
    const now = this.clock.now(),
      before = now - runtimePolicy.inactiveMatchMs;
    for (const id of await this.repo.inactiveIds(before, runtimePolicy.maintenanceBatch))
      if (await this.repo.closeInactive(id, before, now)) this.events.changed(id);
    if (this.chat.available)
      for (const item of await this.repo.finishedGroups(runtimePolicy.maintenanceBatch)) {
        try {
          await this.chat.deleteGroup(item.groupRef);
          await this.repo.clearGroup(item.id, item.groupRef);
        } catch {
          /* Retry on the next bounded sweep; game state stays available. */
        }
      }
  }
}
