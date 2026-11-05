import { describe, it, expect } from 'vitest';
import {
  NewPasswordSchema,
  RegisterSchema,
  LoginSchema,
  ChangePasswordSchema,
} from '../../src/shared';

describe('new password requirements', () => {
  it.each(['River!12', '1234567!A', 'Élan!123', 'Ｒiver！１２'])(
    'accepts a valid new password: %s',
    (password) => {
      expect(NewPasswordSchema.safeParse(password).success).toBe(true);
      expect(
        RegisterSchema.safeParse({ name: 'Test', email: 'test@example.invalid', password }).success,
      ).toBe(true);
      expect(
        ChangePasswordSchema.safeParse({
          currentPassword: 'legacy password',
          newPassword: password,
        }).success,
      ).toBe(true);
    },
  );

  it.each(['Ri!1234', 'river!12', 'River!!!', 'River123', 'River 12', 'R!1' + 'a'.repeat(126)])(
    'rejects missing or out-of-range requirements: %s',
    (password) => {
      expect(NewPasswordSchema.safeParse(password).success).toBe(false);
      expect(
        RegisterSchema.safeParse({ name: 'Test', email: 'test@example.invalid', password }).success,
      ).toBe(false);
      expect(
        ChangePasswordSchema.safeParse({
          currentPassword: 'legacy password',
          newPassword: password,
        }).success,
      ).toBe(false);
    },
  );

  it('accepts the upper bound, normalizes Unicode, and leaves existing login credentials valid', () => {
    expect(NewPasswordSchema.safeParse('R!1' + 'a'.repeat(125)).success).toBe(true);
    expect(NewPasswordSchema.parse('Ｒiver！１２')).toBe('River!12');
    expect(
      LoginSchema.safeParse({ email: 'test@example.invalid', password: 'old lowercase passphrase' })
        .success,
    ).toBe(true);
    expect(
      ChangePasswordSchema.safeParse({
        currentPassword: 'old lowercase passphrase',
        newPassword: 'River!12',
      }).success,
    ).toBe(true);
  });
});
