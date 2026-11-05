import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
const account = z.object({ email: z.string(), password: z.string() }).strict();
const schema = z
  .object({
    baseURL: z.string(),
    users: z
      .object({ host: account, player2: account, player3: account, outsider: account })
      .strict(),
  })
  .strict();
const empty = {
  baseURL: '',
  users: {
    host: { email: '', password: '' },
    player2: { email: '', password: '' },
    player3: { email: '', password: '' },
    outsider: { email: '', password: '' },
  },
};
export async function loadCredentials() {
  const file = resolve('tests/e2e/credentials.js');
  let input: unknown = empty;
  if (existsSync(file)) {
    try {
      input = ((await import(pathToFileURL(file).href)) as { default: unknown }).default;
    } catch {
      throw new Error('Could not load the local test credential file; details suppressed');
    }
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Error('Invalid test credential file shape; use credentials.example.js');
  const value = parsed.data;
  for (const [role, user] of Object.entries(value.users)) {
    const key = role.toUpperCase();
    user.email = process.env[`E2E_${key}_EMAIL`] ?? user.email;
    user.password = process.env[`E2E_${key}_PASSWORD`] ?? user.password;
  }
  value.baseURL = process.env.E2E_LIVE_BASE_URL ?? value.baseURL;
  return value;
}
export const localBaseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:37231';
export const databaseURL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://scalesquad_test@127.0.0.1:55433/scalesquad_e2e_test';
export function assertTestDatabase(value = databaseURL) {
  const url = new URL(value);
  if (process.env.NODE_ENV !== 'test' || !url.pathname.endsWith('_test'))
    throw new Error('E2E seed requires NODE_ENV=test and an isolated *_test database');
  return value;
}
