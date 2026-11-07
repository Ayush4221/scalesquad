import { z } from '../../utils/validation';
import { ConfigurationChange, Id } from '../domain';

export const ConfigUpdateSchema = z
  .object({
    change: ConfigurationChange,
    expectedVersion: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();
export const PassControlSchema = z.object({ targetUserId: Id }).strict();
