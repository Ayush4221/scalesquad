import { randomInt } from 'node:crypto';
import { AppError } from '@scalesquad/shared';
export const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export function generateJoinCode(rng: (max: number) => number = randomInt) {
  return Array.from({ length: 8 }, () => JOIN_ALPHABET[rng(JOIN_ALPHABET.length)]).join('');
}
export async function uniqueJoinCode(
  exists: (code: string) => Promise<boolean>,
  generate = generateJoinCode,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generate();
    if (!(await exists(code))) return code;
  }
  throw new AppError('CONFLICT', 409, 'Could not allocate a join code');
}
