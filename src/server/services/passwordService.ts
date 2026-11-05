import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError } from '@scalesquad/shared';
import { Semaphore } from '../lib/semaphore';
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}
// OWASP minimum: N=2^15,r=8,p=3 (32 MiB). Bound concurrent work to two hashes.
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = '$scrypt$32768$8$3$';
const gate = new Semaphore(2, 16);
function derive(plain: string, salt: Buffer, options = parameters): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(plain, salt, 32, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    const value = normalizePassword(plain);
    return gate.run(async () => {
      const salt = randomBytes(16),
        key = await derive(value, salt);
      return `${prefix}${salt.toString('base64url')}$${key.toString('base64url')}`;
    });
  }
  async verify(hash: string, plain: string) {
    const value = normalizePassword(plain),
      parts = /^\$scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]{22})\$([\w-]{43})$/.exec(hash);
    if (!parts) return false;
    const N = Number(parts[1]),
      r = Number(parts[2]),
      p = Number(parts[3]);
    if (![16384, 32768].includes(N) || r !== 8 || p < 1 || p > 5) return false;
    return gate.run(async () => {
      const key = await derive(value, Buffer.from(parts[4]!, 'base64url'), {
        ...parameters,
        N,
        r,
        p,
      });
      return timingSafeEqual(key, Buffer.from(parts[5]!, 'base64url'));
    });
  }
  needsRehash(hash: string) {
    return !hash.startsWith(prefix);
  }
}
export function normalizePassword(plain: string) {
  const value = plain.normalize('NFKC');
  if (plain.length > 128 || value.length > 128 || !value.length)
    throw new AppError('VALIDATION', 400, 'Invalid password');
  return value;
}
let common: Set<string> | undefined;
export function validatePassword(plain: string, email: string): string {
  const value = normalizePassword(plain);
  common ??= new Set(
    readFileSync(resolve('src/server/data/common-passwords.txt'), 'utf8')
      .split(/\r?\n/)
      .map((p) => p.normalize('NFKC').toLowerCase()),
  );
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (
    [...value].length < 12 ||
    common.has(value.toLowerCase()) ||
    (local.length > 0 && value.toLowerCase().includes(local))
  )
    throw new AppError(
      'VALIDATION',
      400,
      'Use 12–128 characters, avoiding common passwords and your email name',
    );
  return value;
}
