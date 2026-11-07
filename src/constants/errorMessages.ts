import type { ErrorCode } from '../shared/errors';
/** Safe, user-facing defaults for API and WebSocket errors. */
export const errorMessages: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Sign in again to continue.',
  FORBIDDEN: 'You do not have access to this action.',
  NOT_FOUND: 'This item is no longer available.',
  VALIDATION: 'Check the details and try again.',
  CONFLICT: 'This action is not available right now. Refresh and try again.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  PHASE_INVALID: 'The match has moved to another stage. Check the latest view and try again.',
  LOCK_NOT_HELD: 'Another teammate has control. Ask them to pass control before editing.',
  VERSION_CONFLICT: 'A teammate changed the configuration. Review the latest values and try again.',
  INTERNAL: 'Something went wrong. Please try again.',
  UPSTREAM_UNAVAILABLE: 'The service is temporarily unavailable. Please try again.',
  COMPARISON_INPUT_MISMATCH: 'These runs used different conditions and cannot be compared.',
};
