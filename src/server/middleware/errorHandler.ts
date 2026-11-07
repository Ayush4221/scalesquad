import { AppError } from '@scalesquad/shared';
export function safeError(error: unknown, requestId: string) {
  const known =
    error instanceof AppError ? error : new AppError('INTERNAL', 500, 'Something went wrong');
  return {
    status: known.httpStatus,
    body: {
      error: {
        code: known.code,
        message:
          known.httpStatus >= 500 ? 'Service unavailable. Please try again.' : known.safeMessage,
        requestId,
      },
    },
  };
}
