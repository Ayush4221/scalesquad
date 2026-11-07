import { z } from '../../utils/validation';
import { isIP } from 'node:net';
import { validVapid } from './vapid';
export const EnvSchema = z
  .object({
    DATABASE_URL: z
      .url()
      .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://')),
    DIRECT_URL: z.url().refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://')),
    AUTH_SECRET: z.string().min(32),
    AUTH_GOOGLE_ID: z.string().default(''),
    AUTH_GOOGLE_SECRET: z.string().default(''),
    AUTH_GITHUB_ID: z.string().default(''),
    AUTH_GITHUB_SECRET: z.string().default(''),
    APP_ORIGIN: z.url(),
    VAPID_PUBLIC_KEY: z.string().default(''),
    VAPID_PRIVATE_KEY: z.string().default(''),
    VAPID_SUBJECT: z.string().max(254).default(''),
    TRUSTED_PROXY_IPS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean),
      )
      .refine((ips) => ips.every((ip) => isIP(ip) > 0), 'Use explicit proxy IP addresses'),
    NEXCONN_APP_KEY: z.string().default(''),
    NEXCONN_PROVIDER: z.enum(['real', 'disabled', 'fake']).default('real'),
    TEST_BUILT_APP: z
      .enum(['0', '1'])
      .default('0')
      .transform((value) => value === '1'),
    NEXCONN_APP_SECRET: z.string().default(''),
    NEXCONN_REGION: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['SG', 'NA', 'SA']).default('SG'),
    ),
    NODE_ENV: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['development', 'test', 'production']).default('development'),
    ),
    LOG_LEVEL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NEXCONN_PROVIDER === 'fake' || env.TEST_BUILT_APP) {
      if (env.NODE_ENV !== 'test')
        ctx.addIssue({
          code: 'custom',
          path: ['TEST_BUILT_APP'],
          message: 'Test settings require NODE_ENV=test',
        });
      for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const)
        try {
          if (!new URL(env[key]).pathname.endsWith('_test'))
            ctx.addIssue({
              code: 'custom',
              path: [key],
              message: 'Test settings require an isolated *_test database',
            });
        } catch {
          /* URL validation reports this field. */
        }
    }
    if (
      (env.VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY || env.VAPID_SUBJECT) &&
      !validVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['VAPID_PUBLIC_KEY'],
        message: 'Provide a valid matching VAPID key pair and contact',
      });
    for (const provider of ['GOOGLE', 'GITHUB'] as const)
      if (Boolean(env[`AUTH_${provider}_ID`]) !== Boolean(env[`AUTH_${provider}_SECRET`]))
        for (const field of ['ID', 'SECRET'])
          ctx.addIssue({
            code: 'custom',
            path: [`AUTH_${provider}_${field}`],
            message: 'Both OAuth fields required together',
          });
    const parsedOrigin = z.url().safeParse(env.APP_ORIGIN);
    if (!parsedOrigin.success) return;
    const origin = new URL(parsedOrigin.data);
    if (origin.origin !== env.APP_ORIGIN || !['http:', 'https:'].includes(origin.protocol))
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'Must be an origin without a path',
      });
    if (env.NODE_ENV === 'production') {
      if (env.TRUSTED_PROXY_IPS.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['TRUSTED_PROXY_IPS'],
          message: 'Production requires explicit trusted proxy addresses',
        });
      if (origin.protocol !== 'https:')
        ctx.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'HTTPS required' });
      for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const)
        if (
          !z.url().safeParse(env[key]).success ||
          !['require', 'verify-full'].includes(new URL(env[key]).searchParams.get('sslmode') ?? '')
        )
          ctx.addIssue({ code: 'custom', path: [key], message: 'TLS required' });
    }
    if (Boolean(env.NEXCONN_APP_KEY) !== Boolean(env.NEXCONN_APP_SECRET))
      ctx.addIssue({
        code: 'custom',
        path: ['NEXCONN_APP_KEY'],
        message: 'Both Nexconn fields required together',
      });
  });
export type Env = z.infer<typeof EnvSchema>;
export function readEnv(input: Record<string, string | undefined>): Readonly<Env> {
  const result = EnvSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid environment fields: ${[...new Set(result.error.issues.map((i) => i.path[0] ?? 'environment'))].join(', ')}`,
    );
  return Object.freeze(result.data);
}
