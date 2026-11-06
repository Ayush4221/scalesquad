import { SESSION_SECONDS } from '../constants/auth';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import type { Adapter } from 'next-auth/adapters';
import { z } from 'zod';
import { allowedSignIn, publicSession } from './callbacks';
import { getWebEnv } from '@/lib/env';

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getWebEnv();
  const adapter = (globalThis as typeof globalThis & { scaleSquadAuthAdapter?: Adapter })
    .scaleSquadAuthAdapter;
  if (!adapter) throw new Error('Start ScaleSquad through the custom server');
  return {
    adapter,
    secret: env.AUTH_SECRET,
    trustHost: true,
    session: { strategy: 'database', maxAge: SESSION_SECONDS, updateAge: 60 * 15 },
    cookies: {
      sessionToken: {
        name:
          env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: env.NODE_ENV === 'production',
        },
      },
    },
    providers: [
      ...(env.AUTH_GOOGLE_ID
        ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
        : []),
      ...(env.AUTH_GITHUB_ID
        ? [
            GitHub({
              clientId: env.AUTH_GITHUB_ID,
              clientSecret: env.AUTH_GITHUB_SECRET,
              userinfo: {
                url: 'https://api.github.com/user',
                async request({ tokens }: { tokens: { access_token?: string } }) {
                  const headers = {
                    Authorization: `Bearer ${tokens.access_token}`,
                    'User-Agent': 'ScaleSquad',
                  };
                  const [userResponse, emailResponse] = await Promise.all([
                    fetch('https://api.github.com/user', {
                      headers,
                      signal: AbortSignal.timeout(5000),
                    }),
                    fetch('https://api.github.com/user/emails', {
                      headers,
                      signal: AbortSignal.timeout(5000),
                    }),
                  ]);
                  if (!userResponse.ok || !emailResponse.ok)
                    throw new Error('Identity verification failed');
                  const user = z
                    .object({
                      id: z.number(),
                      login: z.string(),
                      name: z.string().nullable(),
                      avatar_url: z.string(),
                    })
                    .passthrough()
                    .parse(await userResponse.json());
                  const emails = z
                    .array(
                      z.object({ email: z.email(), primary: z.boolean(), verified: z.boolean() }),
                    )
                    .parse(await emailResponse.json());
                  const verified = emails.find((e) => e.primary && e.verified);
                  return {
                    ...user,
                    email: verified?.email ?? null,
                    email_verified: verified !== undefined,
                  };
                },
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      signIn: ({ account, user, profile }) => allowedSignIn(account?.provider, user.email, profile),
      session: ({ session, user }) => publicSession(user, session.expires),
      redirect: ({ url }) => {
        try {
          const target = new URL(url, env.APP_ORIGIN);
          return target.origin === env.APP_ORIGIN ? target.href : env.APP_ORIGIN;
        } catch {
          return env.APP_ORIGIN;
        }
      },
    },
    pages: { signIn: '/signin' },
    logger: { error: () => {}, warn: () => {}, debug: () => {} },
  };
});
export async function getCurrentUser() {
  const session = await auth();
  return session?.user?.id
    ? {
        userId: session.user.id,
        name: session.user.name ?? 'Player',
      }
    : null;
}
