import { AppError, ErrorCode } from '@scalesquad/shared';
import { errorMessages } from '@/constants/errorMessages';

export async function api<T>(
  path: string,
  body?: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? (path.endsWith('/runs') ? 60000 : 30000));
  try {
    const response = await fetch(`/api/game${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const code =
        response.status === 401
          ? 'UNAUTHENTICATED'
          : response.status === 429
            ? 'RATE_LIMITED'
            : 'UPSTREAM_UNAVAILABLE';
      const seconds = Number(response.headers.get('Retry-After'));
      throw new AppError(
        code,
        response.ok ? 502 : response.status,
        response.status === 429 || response.status === 401
          ? errorMessages[code]
          : 'The service returned an unreadable response. Please try again.',
        Number.isFinite(seconds) && seconds > 0
          ? { retryAfterSeconds: Math.min(seconds, 86400) }
          : {},
      );
    }
    if (!response.ok) {
      const raw = typeof data === 'object' && data !== null && 'error' in data ? data.error : null;
      const detail = typeof raw === 'object' && raw !== null ? raw : {};
      const parsedCode = ErrorCode.safeParse('code' in detail ? detail.code : null);
      const code =
        response.status === 401
          ? 'UNAUTHENTICATED'
          : response.status === 429
            ? 'RATE_LIMITED'
            : response.status >= 500
              ? 'UPSTREAM_UNAVAILABLE'
              : parsedCode.success
                ? parsedCode.data
                : 'VALIDATION';
      const useDefault =
        response.status >= 500 ||
        [
          'LOCK_NOT_HELD',
          'PHASE_INVALID',
          'VERSION_CONFLICT',
          'COMPARISON_INPUT_MISMATCH',
        ].includes(code);
      const message =
        !useDefault &&
        'message' in detail &&
        typeof detail.message === 'string' &&
        detail.message.trim()
          ? detail.message
          : errorMessages[code];
      const seconds = Number(response.headers.get('Retry-After'));
      throw new AppError(
        code,
        response.status,
        message,
        Number.isFinite(seconds) && seconds > 0
          ? { retryAfterSeconds: Math.min(seconds, 86400) }
          : {},
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      'UPSTREAM_UNAVAILABLE',
      503,
      controller.signal.aborted
        ? 'The request took too long. Please try again.'
        : 'Cannot reach the service. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
