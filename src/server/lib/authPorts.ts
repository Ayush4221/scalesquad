export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: number | null;
  passwordHash: string | null;
  failedLoginCount: number;
  passwordChangedAt: number | null;
}
export interface UserAuthRepository {
  byEmail(email: string): Promise<AuthUser | null>;
  byId(id: string): Promise<AuthUser | null>;
  register(email: string, name: string, hash: string): Promise<AuthUser | null>;
  failed(id: string, now: number): Promise<void>;
  login(
    id: string,
    expectedHash: string,
    nextHash: string | null,
    session: { token: string; expires: number },
    oldToken: string | null,
  ): Promise<boolean>;
  change(
    id: string,
    expectedHash: string,
    hash: string,
    currentToken: string,
    now: number,
  ): Promise<boolean>;
}
export interface SessionWriteRepository {
  remove(token: string): Promise<void>;
  removeAll(userId: string): Promise<void>;
}
export type AuthEventType =
  | 'REGISTER'
  | 'LOGIN_OK'
  | 'LOGIN_FAIL'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'PASSWORD_CHANGE'
  | 'THROTTLED';
export interface AuthEventRepository {
  record(
    type: AuthEventType,
    userId: string | null,
    ipPrefix: string,
    userAgent: string,
  ): Promise<void>;
}
export interface AuthContext {
  ip: string;
  userAgent: string;
  sessionToken: string | null;
}
