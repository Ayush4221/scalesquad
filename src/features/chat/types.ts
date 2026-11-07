import type { Role } from '@scalesquad/shared';
export interface ChatMember {
  userId: string;
  name: string;
  role?: Role | null | undefined;
}
export interface ChatDraft {
  text: string;
  id: number;
}
export const roleLabels: Record<Role, string> = {
  TRAFFIC: 'Traffic',
  DATA: 'Data',
  OPS: 'Operations',
};
