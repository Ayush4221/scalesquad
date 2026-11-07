import type { z } from 'zod';
import type { RegisterSchema, LoginSchema, ChangePasswordSchema } from '../validations/auth.schema';
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
/** Server-only handoff after the provider's email ownership claim is checked. */
export interface VerifiedOAuthIdentity {
  provider: 'google' | 'github';
  providerAccountId: string;
  type: 'oauth' | 'oidc';
  email: string;
  name: string | null;
  image: string | null;
}
