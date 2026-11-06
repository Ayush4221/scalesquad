/** Human-readable codes omit easily confused I, O, 0 and 1. */
export const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;
export const JOIN_CODE_PATTERN = new RegExp(`^[${JOIN_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);
