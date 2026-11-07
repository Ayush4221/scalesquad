import { z } from '../../utils/validation';
/** Clients choose only the run action; inputs and snapshots are server-owned. */
export const StartRunSchema = z
  .object({
    runNumber: z.union([z.literal(1), z.literal(3)]),
  })
  .strict();
