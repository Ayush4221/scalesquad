import { AppError, requireUser } from '@scalesquad/shared';
import type { MatchRecord } from '../domain/models';
export function member(m: MatchRecord, userId: string | null) {
  requireUser(userId);
  const u = m.members.find((p) => p.userId === userId);
  if (!u) throw new AppError('FORBIDDEN', 403);
  return u;
}
export function host(m: MatchRecord, userId: string | null) {
  member(m, userId);
  if (m.hostUserId !== userId) throw new AppError('FORBIDDEN', 403);
}
export function phase(m: MatchRecord, ...allowed: MatchRecord['phase'][]) {
  if (!allowed.includes(m.phase)) throw new AppError('PHASE_INVALID', 409);
}
export function editable(m: MatchRecord, userId: string | null, now: number) {
  member(m, userId);
  phase(m, 'REPAIR_1', 'REPAIR_2');
  if (m.simulationLocked) throw new AppError('CONFLICT', 409, 'Simulation is in progress');
  if (!m.lock || m.lock.holderUserId !== userId || m.lock.expiresAt <= now)
    throw new AppError('LOCK_NOT_HELD', 403);
  return m.lock;
}
export function currentConfig(m: MatchRecord) {
  const config = m.configurations.at(-1);
  if (!config) throw new AppError('INTERNAL', 500);
  return config;
}
export function audit(
  m: MatchRecord,
  userId: string,
  action: string,
  detail: Record<string, string | number | boolean> = {},
) {
  m.audit.push({ id: `${m.id}_${m.audit.length}`, userId, action, detail });
}
