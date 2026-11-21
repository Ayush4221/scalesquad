export interface ChatAccess {
  token: string;
  appKey: string;
  region: 'SG' | 'NA' | 'SA';
}
export interface ChatProvider {
  readonly available: boolean;
  groupReference(matchId: string): string;
  createGroup(matchId: string, members: string[]): Promise<string>;
  addMember(groupRef: string, userId: string): Promise<void>;
  removeMember(groupRef: string, userId: string): Promise<void>;
  mintUserToken(userId: string): Promise<ChatAccess>;
  sendSystemNotice(groupRef: string, notice: string): Promise<void>;
  deleteGroup(groupRef: string): Promise<void>;
}
