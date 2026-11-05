import { z } from 'zod';
export const normalizeEmail = (email: string) => email.trim().normalize('NFKC').toLowerCase();
export const EmailSchema = z.string().max(254).transform(normalizeEmail).pipe(z.email().max(254));
export const PasswordSchema = z
  .string()
  .min(1)
  .max(128)
  .transform((value) => value.normalize('NFKC'))
  .pipe(z.string().min(1).max(128));
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS =
  'Use 8–128 characters with at least one uppercase letter, one special character and one number.';

export function getPasswordRequirements(password: string) {
  const value = password.normalize('NFKC');
  return {
    minLength: [...value].length >= PASSWORD_MIN_LENGTH,
    uppercase: /\p{Lu}/u.test(value),
    special: /[\p{P}\p{S}]/u.test(value),
    number: /\p{Nd}/u.test(value),
  };
}

// Only new passwords use the current policy; login keeps accepting existing credentials.
export const NewPasswordSchema = PasswordSchema.refine(
  (value) => Object.values(getPasswordRequirements(value)).every(Boolean),
  PASSWORD_REQUIREMENTS,
);
export const EmailBody = z.object({ email: EmailSchema }).strict();
export const RegisterSchema = EmailBody.extend({
  name: z.string().trim().min(1).max(60),
  password: NewPasswordSchema,
}).strict();
export const LoginSchema = EmailBody.extend({ password: PasswordSchema }).strict();
export const ChangePasswordSchema = z
  .object({ currentPassword: PasswordSchema, newPassword: NewPasswordSchema })
  .strict();
