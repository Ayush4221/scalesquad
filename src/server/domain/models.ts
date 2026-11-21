import type {
  ConfigurationView,
  EvidenceCard,
  EvidencePhase,
  MatchPhase,
  Role,
  RunNumber,
  SimulationResult,
} from '@scalesquad/shared';
export interface Member {
  userId: string;
  name: string;
  role: Role;
  ready: boolean;
  acknowledged: boolean;
  lastSeenAt: number;
  disconnectedAt: number | null;
}
export interface StoredRun {
  runNumber: RunNumber;
  configurationVersion: number;
  snapshotHash: string;
  input: unknown;
  result: SimulationResult;
}
export interface MatchRecord {
  id: string;
  createdAt: number;
  joinCode: string;
  joinCodeExpiresAt: number;
  hostUserId: string;
  phase: MatchPhase;
  scenarioId: string;
  scenarioVersion: string;
  engineVersion: string;
  revision: number;
  simulationLocked: boolean;
  deadlineAt: number | null;
  runStartedAt: number | null;
  runError: boolean;
  endedAt: number | null;
  members: Member[];
  configurations: (ConfigurationView & { createdByUserId: string })[];
  lock: { holderUserId: string; expiresAt: number; configurationVersion: number } | null;
  runs: StoredRun[];
  evidence: { userId: string; phase: EvidencePhase; card: EvidenceCard }[];
  audit: {
    id: string;
    userId: string;
    action: string;
    detail: Record<string, string | number | boolean>;
  }[];
  groupRef: string | null;
  chatAvailable: boolean;
}
export interface ChatReconciliation {
  id: string;
  version: string;
  matchId: string;
  groupRef: string;
  userId: string | null;
  retryAt: number;
}
export interface GameRepository {
  saveChatTask(task: ChatReconciliation): Promise<void>;
  findChatTask(id: string): Promise<ChatReconciliation | null>;
  pendingChatTasks(now: number, limit: number): Promise<ChatReconciliation[]>;
  completeChatTask(id: string, version: string): Promise<void>;
  deferChatTask(id: string, version: string, retryAt: number): Promise<void>;
  create(match: MatchRecord): Promise<void>;
  find(id: string): Promise<MatchRecord | null>;
  findByCode(code: string): Promise<MatchRecord | null>;
  active(): Promise<MatchRecord[]>;
  dueIds(now: number, limit: number): Promise<string[]>;
  inactiveIds(before: number, limit: number): Promise<string[]>;
  countHosted(userId: string, since: number): Promise<{ active: number; recent: number }>;
  countMemberships(userId: string): Promise<number>;
  presenceState(
    matchId: string,
    userId: string,
  ): Promise<{
    scenarioId: string;
    scenarioVersion: string;
    phase: MatchPhase;
    simulationLocked: boolean;
    lock: MatchRecord['lock'];
  } | null>;
  recordPresence(
    matchId: string,
    userId: string,
    now: number,
    connected: boolean,
    renewUntil: number | null,
  ): Promise<void>;
  closeInactive(matchId: string, before: number, now: number): Promise<boolean>;
  clearGroup(matchId: string, groupRef: string): Promise<void>;
  finishedGroups(limit: number): Promise<{ id: string; groupRef: string }[]>;
  mutate<T>(id: string, fn: (m: MatchRecord) => T): Promise<T>;
  delete(id: string): Promise<void>;
}
export interface SessionRepository {
  find(token: string): Promise<{ userId: string; name: string; expires: number } | null>;
}
export interface EvidenceRepository {
  listForOwner(matchId: string, userId: string): Promise<EvidenceCard[]>;
}
export interface UserRepository {
  find(id: string): Promise<{ userId: string; name: string; emailVerified: boolean } | null>;
}
