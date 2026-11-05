import type { z } from 'zod';
import type { StartRunSchema } from '../validations';
export type StartRunDto = z.infer<typeof StartRunSchema>;
