import { z } from 'zod';
export const normalizeEmail = (email: string) => email.trim().normalize('NFKC').toLowerCase();
export const EmailSchema = z.string().max(254).transform(normalizeEmail).pipe(z.email().max(254));
export const PasswordSchema = z
  .string()
  .min(1)
  .max(128)
  .transform((value) => value.normalize('NFKC'))
  .pipe(z.string().min(1).max(128));
export const EmailBody = z.object({ email: EmailSchema }).strict();
export const RegisterSchema = EmailBody.extend({
  name: z.string().trim().min(1).max(60),
  password: PasswordSchema,
}).strict();
export const LoginSchema = EmailBody.extend({ password: PasswordSchema }).strict();
export const ChangePasswordSchema = z
  .object({ currentPassword: PasswordSchema, newPassword: PasswordSchema })
  .strict();
