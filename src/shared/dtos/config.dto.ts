import type { z } from 'zod';
import type { ConfigUpdateSchema, PassControlSchema } from '../validations';
export type ConfigUpdateDto = z.infer<typeof ConfigUpdateSchema>;
export type PassControlDto = z.infer<typeof PassControlSchema>;
