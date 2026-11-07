import { z } from '../utils/validation';
import { errorMessages } from '../constants/errorMessages';

export const ErrorCode = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'RATE_LIMITED',
  'PHASE_INVALID',
  'LOCK_NOT_HELD',
  'VERSION_CONFLICT',
  'INTERNAL',
  'UPSTREAM_UNAVAILABLE',
  'COMPARISON_INPUT_MISMATCH',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export class AppError extends Error {
  public readonly retryAfterSeconds: number | undefined;
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus = 400,
    public readonly safeMessage = errorMessages[code],
    options?: ErrorOptions & { retryAfterSeconds?: number },
  ) {
    super(safeMessage, options);
    this.name = 'AppError';
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
  toJSON() {
    return { code: this.code, message: this.safeMessage };
  }
}
export function requireUser(userId: string | null): asserts userId is string {
  if (!userId) throw new AppError('UNAUTHENTICATED', 401);
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION', 400, 'Invalid input');
  return result.data;
}
