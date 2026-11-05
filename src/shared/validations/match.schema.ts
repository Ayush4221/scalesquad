import { z } from 'zod';
import { Id } from '../domain';

export const EmptyBodySchema = z.object({}).strict();
export const EmptyQuerySchema = z.object({}).strict();
export const MatchParamsSchema = z.object({ matchId: Id }).strict();
export const JoinMatchSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NP-Z2-9]{8}$/),
  })
  .strict();
export const ReadySchema = z.object({ ready: z.boolean() }).strict();
export const ChatTokenSchema = MatchParamsSchema;
