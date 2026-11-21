import { AppError } from '@scalesquad/shared';
import type { ChatProvider } from './index';
/** Unit tests only; bootstrap never selects this provider. */
export class FakeChatProvider implements ChatProvider {
  readonly available = true;
  groupReference(matchId: string) {
    return matchId;
  }
  readonly groups = new Map<string, Set<string>>();
  readonly notices: string[] = [];
  async createGroup(id: string, members: string[]) {
    this.groups.set(id, new Set(members));
    return id;
  }
  async addMember(group: string, userId: string) {
    this.groups.get(group)?.add(userId);
  }
  async removeMember(group: string, userId: string) {
    this.groups.get(group)?.delete(userId);
  }
  async mintUserToken(userId: string) {
    return { token: `test-${userId}`, appKey: 'test-key', region: 'SG' as const };
  }
  async sendSystemNotice(_group: string, notice: string) {
    this.notices.push(notice);
  }
  async deleteGroup(group: string) {
    this.groups.delete(group);
  }
}
export class DisabledChatProvider implements ChatProvider {
  readonly available = false;
  groupReference(matchId: string) {
    return matchId;
  }
  private fail(): never {
    throw new AppError('UPSTREAM_UNAVAILABLE', 503, 'Chat is unavailable');
  }
  async createGroup(): Promise<string> {
    return this.fail();
  }
  async addMember(): Promise<void> {
    this.fail();
  }
  async removeMember(): Promise<void> {
    this.fail();
  }
  async mintUserToken(): Promise<never> {
    return this.fail();
  }
  async sendSystemNotice(): Promise<void> {
    this.fail();
  }
  async deleteGroup(): Promise<void> {
    this.fail();
  }
}
