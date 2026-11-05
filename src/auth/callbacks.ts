export function allowedSignIn(
  provider: string | undefined,
  email: string | null | undefined,
  profile: unknown,
): boolean {
  if (!email || typeof profile !== 'object' || profile === null) return false;
  if (provider === 'google') return 'email_verified' in profile && profile.email_verified === true;
  if (provider === 'github') return 'email_verified' in profile && profile.email_verified === true;
  return false;
}
export function publicSession(
  user: { id: string; name?: string | null; emailVerified?: Date | null },
  expires: string,
) {
  return {
    user: {
      id: user.id,
      name: user.name ?? 'Player',
      verified: user.emailVerified instanceof Date,
    },
    expires,
  };
}
