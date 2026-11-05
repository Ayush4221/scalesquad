import { AppError } from '@scalesquad/shared';
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/game${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data ? data.error : null;
    if (response.status === 401)
      throw new AppError('UNAUTHENTICATED', 401, 'Sign in again to continue');
    throw new Error(
      typeof message === 'object' &&
        message !== null &&
        'message' in message &&
        typeof message.message === 'string'
        ? message.message
        : 'Request failed',
    );
  }
  return data as T;
}
