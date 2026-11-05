import type { z } from 'zod';
import type { RegisterSchema, LoginSchema, ChangePasswordSchema } from '../validations/auth.schema';
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
