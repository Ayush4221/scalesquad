import { AppError, ErrorCode } from '@scalesquad/shared';
import { errorMessages } from '@/constants/errorMessages';

/** Friendly fallbacks also cover older servers that send raw enum names. */
export function clientErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (
    error instanceof AppError &&
    ['LOCK_NOT_HELD', 'PHASE_INVALID', 'VERSION_CONFLICT', 'COMPARISON_INPUT_MISMATCH'].includes(
      error.code,
    )
  )
    return errorMessages[error.code];
  if (error instanceof Error) {
    const code = ErrorCode.safeParse(error.message.replaceAll(' ', '_'));
    return code.success ? errorMessages[code.data] : error.message || fallback;
  }
  return fallback;
}
