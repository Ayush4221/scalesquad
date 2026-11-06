import { z } from 'zod';
import {
  Id,
  ConfigurationView,
  EvidencePhase,
  MatchPhase,
  PublicMatchView,
  RunNumber,
  SimulationResult,
} from './domain';
import { ErrorCode } from './errors';
import {
  EmptyBodySchema,
  MatchParamsSchema,
  ReadySchema,
  PassControlSchema,
  ConfigUpdateSchema,
  StartRunSchema,
} from './validations';

const envelope = <T extends string, S extends z.ZodType>(type: T, payload: S) =>
  z
    .object({
      v: z.literal(1),
      type: z.literal(type),
      id: Id,
      payload,
    })
    .strict();
const matchId = MatchParamsSchema;
export const ClientEvent = z.discriminatedUnion('type', [
  envelope('ping', EmptyBodySchema),
  envelope('presence.visibility', z.object({ foreground: z.boolean() }).strict()),
  envelope('match.subscribe', matchId),
  envelope('player.ready', matchId.extend(ReadySchema.shape)),
  envelope('brief.ack', matchId),
  envelope('lock.pass', matchId.extend(PassControlSchema.shape)),
  envelope('lock.reclaim', matchId),
  envelope('config.update', matchId.extend(ConfigUpdateSchema.shape)),
  envelope('run.start', matchId.extend(StartRunSchema.shape)),
]);
export type ClientEvent = z.infer<typeof ClientEvent>;
export const ServerEvent = z.discriminatedUnion('type', [
  envelope('hello', z.object({ userId: Id }).strict()),
  envelope('match.snapshot', PublicMatchView),
  envelope('match.phase', z.object({ matchId: Id, phase: MatchPhase }).strict()),
  envelope('match.members', z.object({ matchId: Id }).strict()),
  envelope('config.updated', z.object({ matchId: Id, configuration: ConfigurationView }).strict()),
  envelope(
    'lock.changed',
    z.object({ matchId: Id, holderUserId: Id, expiresAt: z.number() }).strict(),
  ),
  envelope('evidence.available', z.object({ phase: EvidencePhase }).strict()),
  envelope('run.started', z.object({ matchId: Id, runNumber: RunNumber }).strict()),
  envelope(
    'run.completed',
    z.object({ matchId: Id, runNumber: RunNumber, summary: SimulationResult }).strict(),
  ),
  envelope('error', z.object({ code: ErrorCode, message: z.string().max(200) }).strict()),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
export { MAX_MESSAGE_BYTES } from '../constants/protocol';
