import { randomUUID } from 'node:crypto';
import { contentHash } from '@scalesquad/shared';
import type { ChatProvider } from '@scalesquad/nexconn';
import type { ChatReconciliation, GameRepository } from '../domain/models';
import type { Clock } from '../domain/ports';
import { runtimePolicy } from '../constants/runtimePolicy';
import { KeyedQueue } from '../utils/keyedQueue';

export class ChatReconciliationService {
  constructor(
    private readonly repo: GameRepository,
    private readonly chat: ChatProvider,
    private readonly clock: Clock,
    private readonly memberships: KeyedQueue,
  ) {}
  private key(matchId: string, userId: string | null) {
    return contentHash([matchId, userId]);
  }
  async record(matchId: string, groupRef: string, userId: string | null) {
    const task: ChatReconciliation = {
      id: this.key(matchId, userId),
      version: randomUUID(),
      matchId,
      groupRef,
      userId,
      retryAt: this.clock.now(),
    };
    await this.repo.saveChatTask(task);
    return task;
  }
  complete(task: ChatReconciliation) {
    return this.repo.completeChatTask(task.id, task.version);
  }
  /** Caller holds the same membership queue used by create/join/leave/start. */
  async settle(task: ChatReconciliation) {
    const current = await this.repo.findChatTask(task.id);
    if (current?.version !== task.version) return;
    const match = await this.repo.find(task.matchId);
    if (!match || match.groupRef !== task.groupRef || match.phase === 'FINISHED') {
      await this.chat.deleteGroup(task.groupRef);
      if (match?.groupRef === task.groupRef)
        await this.repo.clearGroup(task.matchId, task.groupRef);
    } else if (task.userId !== null) {
      if (match.members.some((member) => member.userId === task.userId))
        await this.chat.addMember(task.groupRef, task.userId);
      else await this.chat.removeMember(task.groupRef, task.userId);
    }
    await this.complete(task);
  }
  async member(matchId: string, userId: string) {
    const task = await this.repo.findChatTask(this.key(matchId, userId));
    if (task) await this.settle(task);
  }
  async sweep() {
    if (!this.chat.available) return;
    for (const task of await this.repo.pendingChatTasks(
      this.clock.now(),
      runtimePolicy.maintenanceBatch,
    )) {
      await this.memberships.run(task.matchId, async () => {
        try {
          await this.settle(task);
        } catch {
          await this.repo.deferChatTask(
            task.id,
            task.version,
            this.clock.now() + runtimePolicy.chatReconciliationRetryMs,
          );
        }
      });
    }
  }
}
