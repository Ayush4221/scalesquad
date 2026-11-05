import { z } from 'zod';
const schema = z.object({
  APP_ORIGIN: z.url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().default(''),
  AUTH_GOOGLE_SECRET: z.string().default(''),
  AUTH_GITHUB_ID: z.string().default(''),
  AUTH_GITHUB_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});
/** Called only inside server auth code; never import into a client component. */
export function getWebEnv() {
  return schema.parse(process.env);
}
