import {
  parse,
  EmptyBodySchema,
  JoinMatchSchema,
  ReadySchema,
  ConfigUpdateSchema,
  PassControlSchema,
  StartRunSchema,
  ChatTokenSchema,
  type JoinMatchDto,
  type ReadyDto,
  type ConfigUpdateDto,
  type PassControlDto,
  type StartRunDto,
  type ChatTokenRequestDto,
  type MatchDto,
} from '@scalesquad/shared';
import type { MatchService } from '../services/matchService';
import type { ConfigService } from '../services/configService';
import type { EditLockService } from '../services/editLockService';
import type { EvidenceService } from '../services/evidenceService';
import type { RunService } from '../services/runService';

export interface Context {
  userId: string | null;
  name: string | null;
  matchId: string;
  body: unknown;
  userAgent?: string;
  ip?: string;
  sessionToken?: string | null;
}
export interface GameServices {
  match: MatchService;
  config: ConfigService;
  lock: EditLockService;
  evidence: EvidenceService;
  run: RunService;
}
/** Transport validation and one service call per action. Business rules stay in services. */
export function gameControllers(s: GameServices) {
  return {
    me: async (c: Context) => ({ userId: c.userId, name: c.name }),
    create: async (c: Context): Promise<MatchDto> => {
      parse(EmptyBodySchema, c.body);
      return s.match.createMatch(c.userId);
    },
    join: async (c: Context): Promise<MatchDto> => {
      const b: JoinMatchDto = parse(JoinMatchSchema, c.body);
      return s.match.joinMatch(c.userId, b.code);
    },
    view: async (c: Context): Promise<MatchDto> => s.match.getPublicView(c.userId, c.matchId),
    ready: async (c: Context) => {
      const b: ReadyDto = parse(ReadySchema, c.body);
      return s.match.setReady(c.userId, c.matchId, b.ready);
    },
    start: async (c: Context) => {
      parse(EmptyBodySchema, c.body);
      return s.match.startMatch(c.userId, c.matchId);
    },
    advance: async (c: Context) => {
      parse(EmptyBodySchema, c.body);
      return s.match.advance(c.userId, c.matchId);
    },
    leave: async (c: Context) => {
      parse(EmptyBodySchema, c.body);
      return s.match.leaveMatch(c.userId, c.matchId);
    },
    acknowledge: async (c: Context) => {
      parse(EmptyBodySchema, c.body);
      return s.match.acknowledge(c.userId, c.matchId);
    },
    evidence: async (c: Context) => s.evidence.get(c.userId, c.matchId),
    config: async (c: Context) => s.config.get(c.userId, c.matchId),
    update: async (c: Context) => {
      const b: ConfigUpdateDto = parse(ConfigUpdateSchema, c.body);
      return s.config.update(c.userId, c.matchId, b.change, b.expectedVersion);
    },
    pass: async (c: Context) => {
      const b: PassControlDto = parse(PassControlSchema, c.body);
      return s.lock.passControl(c.userId, c.matchId, b.targetUserId);
    },
    reclaim: async (c: Context) => {
      parse(EmptyBodySchema, c.body);
      return s.lock.reclaim(c.userId, c.matchId);
    },
    runs: async (c: Context) => s.run.get(c.userId, c.matchId),
    run: async (c: Context) => {
      const b: StartRunDto = parse(StartRunSchema, c.body);
      return s.run.start(c.userId, c.matchId, b.runNumber);
    },
    token: async (c: Context) => {
      const b: ChatTokenRequestDto = parse(ChatTokenSchema, c.body);
      return s.match.chatToken(c.userId, b.matchId);
    },
  };
}
export type GameControllers = ReturnType<typeof gameControllers>;
