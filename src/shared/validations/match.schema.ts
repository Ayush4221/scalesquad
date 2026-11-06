import { JOIN_CODE_PATTERN } from '../../constants/joinCode';
import { z } from 'zod';
import { Id } from '../domain';
export const ScenarioId = z.enum(['campuspass', 'retry-storm', 'split-gates', 'flash-crowd']);
export type ScenarioId = z.infer<typeof ScenarioId>;
export const CreateMatchSchema = z
  .object({ scenarioId: ScenarioId.default('campuspass') })
  .strict();

export const EmptyBodySchema = z.object({}).strict();
export const EmptyQuerySchema = z.object({}).strict();
export const MatchParamsSchema = z.object({ matchId: Id }).strict();
export const JoinMatchSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(JOIN_CODE_PATTERN),
  })
  .strict();
export const ReadySchema = z.object({ ready: z.boolean() }).strict();
export const ChatTokenSchema = MatchParamsSchema;
