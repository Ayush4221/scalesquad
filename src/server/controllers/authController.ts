import {
  parse,
  RegisterSchema,
  LoginSchema,
  ChangePasswordSchema,
  EmptyBodySchema,
} from '@scalesquad/shared';
import type { AuthService } from '../services/authService';
import type { Context } from './gameController';
import type { AuthContext } from '../lib/authPorts';
export interface AuthOutput {
  body: unknown;
  session?: { token: string; clear: boolean };
}
const context = (c: Context): AuthContext => ({
  ip: c.ip ?? 'unknown',
  userAgent: c.userAgent ?? '',
  sessionToken: c.sessionToken ?? null,
});
export function authControllers(service: AuthService) {
  return {
    authThrottled: async (c: Context) => service.throttled(context(c)),
    authRegister: async (c: Context): Promise<AuthOutput> => ({
      body: await service.register(parse(RegisterSchema, c.body), context(c)),
    }),
    authLogin: async (c: Context): Promise<AuthOutput> => {
      const b = parse(LoginSchema, c.body),
        session = await service.login(b.email, b.password, context(c));
      return { body: { ok: true }, session: { token: session.token, clear: false } };
    },
    authLogout: async (c: Context): Promise<AuthOutput> => {
      parse(EmptyBodySchema, c.body);
      return {
        body: await service.logout(c.userId, context(c)),
        session: { token: '', clear: true },
      };
    },
    authLogoutAll: async (c: Context): Promise<AuthOutput> => {
      parse(EmptyBodySchema, c.body);
      return {
        body: await service.logoutEverywhere(c.userId, context(c)),
        session: { token: '', clear: true },
      };
    },
    authChange: async (c: Context): Promise<AuthOutput> => {
      const b = parse(ChangePasswordSchema, c.body);
      return {
        body: await service.changePassword(c.userId, b.currentPassword, b.newPassword, context(c)),
      };
    },
  };
}
