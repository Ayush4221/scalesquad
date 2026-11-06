import type { z } from 'zod';
import type {
  PublicMatchView,
  EvidenceCard,
  ConfigurationView,
  RunView,
  Comparison,
} from '../domain';
import type {
  JoinMatchSchema,
  CreateMatchSchema,
  ReadySchema,
  ChatTokenSchema,
  MatchParamsSchema,
} from '../validations';

export type JoinMatchDto = z.infer<typeof JoinMatchSchema>;
export type CreateMatchDto = z.infer<typeof CreateMatchSchema>;
export type ReadyDto = z.infer<typeof ReadySchema>;
export type ChatTokenRequestDto = z.infer<typeof ChatTokenSchema>;
export type MatchParamsDto = z.infer<typeof MatchParamsSchema>;
export type MatchDto = PublicMatchView;
export type PrivateEvidenceDto = EvidenceCard;
export type ConfigurationDto = ConfigurationView;
export type SimulationRunDto = RunView;
export type RunComparisonDto = Comparison;
