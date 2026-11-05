# Authentication

The owner chose simple email/password signup and login on 2026-11-05. Email
verification, SMTP/API delivery and email-based password recovery are removed.
This supersedes the mail steps in the original plan 11. No mail settings are
required in development or production.

## User flow

1. Create an account with name, email and password.
2. Sign in with that email and password immediately.
3. Create or join a squad.
4. Change a password in Settings using the current password.
5. Sign out from this device or everywhere.

There is no forgotten-password recovery for now. Signup does not claim that the
email address is verified. Existing and new addresses receive the same generic
registration response; a duplicate registration cannot replace a password.

## Code flow

Signup and login share the owner-selected split-screen design through
`AuthLayout`, `AuthStory` and `auth.module.css`. `SignupPage` composes `SignupForm`;
the sign-in route composes `LoginForm` and optional configured OAuth providers.
On phones, the form takes priority. Shared `FormField` and `PasswordInput`
components own labels, error descriptions and the accessible reveal control.
Every color comes from the shared palette. Account settings uses `ChangePasswordForm`.

Login uses the shared `LoginSchema` for normalized email/password inputs, shows
field errors and focuses the first invalid field. A synchronous guard blocks
repeat submissions. Request failures stay generic and focus the error message;
entered values remain available for retry. Success clears the password and loads
`/play` with the server-issued session cookie. Password-manager autocomplete,
keyboard submission and the show/hide control remain available.

The approved login uses matte icon fields and selective glass accents on its
buttons, badge and role cards. All colors derive from the shared palette.
`LoginSubmitButton` keeps its size through idle, request-loading and confirmed
success states. Loading follows the real request; success shows a check for
350 ms before the authenticated page reload (immediate with reduced motion).
Fields, reveal and duplicate submission stay locked until navigation. Unmount
cancels pending navigation, and failures restore retry with generic feedback.
CSS entrances, role-card tilt and connected signals respect reduced motion.

The signup form reuses the shared registration schema, displays field errors,
focuses the first invalid field and guards duplicate submissions. Inputs lock
while a request is pending. Failed requests keep entered values for retry;
success clears the password and offers a direct sign-in link. The generic
registration outcome is the same for new and existing addresses.

The auth forms send requests to `/api/game/auth`. The HTTP router checks Origin,
limits and session access. `authController` validates shared DTO schemas, then
calls `AuthService`. The service applies password/session rules and calls
repositories. Only repositories access Prisma. See `project-flow.md` for the map.

Google/GitHub remain optional through Auth.js. Password and OAuth sign-in use
the same database Session table and cookies. There is no JWT credentials path.

## Passwords and sessions

Built-in scrypt uses N=32768, r=8, p=3, random 16-byte salts and 32-byte derived
keys. Two hashes run together and at most 16 wait. Unsupported parameters fail
closed; supported older hashes upgrade after login. Passwords normalize NFKC,
allow spaces/Unicode, and new passwords require 8–128 characters with at least
one uppercase letter, one punctuation/symbol character and one number (owner
update, 2026-11-05). Spaces do not count as special characters. The shared
`NewPasswordSchema` enforces this for signup and password changes; both screens
show a live requirements checklist. Existing passwords still work for login.
Common values and the email local-part remain rejected. Pepper and CAPTCHA
remain off by owner choice.

Unknown users, OAuth-only users and wrong passwords get the same login failure.
Failures receive progressive delays and per-IP/per-email limits. Passwords and
sessions never enter persistent browser storage or logs.

Database sessions last eight hours. Login replaces the presented session;
password change keeps only the current session; logout-all removes every session
for that user. Each operation revokes affected WebSockets immediately. Cookie
flags are HttpOnly, SameSite=Lax and Path=/; production also requires Secure and
the `__Secure-authjs.session-token` name.

## OAuth and email ownership

Only verified Google email or GitHub primary verified email claims are accepted.
Provider access, refresh and ID tokens are discarded. Password accounts keep
`emailVerified` null because signup no longer proves mailbox ownership.

Accounts are not automatically linked by matching email text. Auth.js's default
account-linking rejection remains enabled. OAuth sign-in does not delete a
password account, clear its password or replace its sessions. Users must keep
using their original sign-in method when an email already belongs to an account.

## Routes and limits

| POST route under `/api/game/auth` | Access and limit                                   |
| --------------------------------- | -------------------------------------------------- |
| register                          | Public; 5/hour/IP and 3/day/email                  |
| login                             | Public; 10/15 minutes/IP and 5/15 minutes/email+IP |
| change-password                   | Session; 5/hour/user and current password required |
| logout, logout-all                | Session; general API limit                         |

The old verify/resend/forgot/reset routes and pages are removed. Unknown API
routes retain the deny-by-default boundary: guests get 401 and authenticated
users get 404. No email tokens are issued or consumed. Historical migration
files and the existing token table remain for database compatibility; this
cleanup does not drop stored data or rewrite applied migrations.

Every mutation checks Origin. Strict shared schemas reject unknown fields, API
responses are no-store and audit events omit emails/passwords/tokens. Configure
exact `TRUSTED_PROXY_IPS` behind Caddy and keep Node on loopback.

## Database URLs

`DATABASE_URL` is used by application queries. `DIRECT_URL` is used by Prisma
migration tooling. Both can be the same connection string for local Postgres or
any direct-only setup. A hosted provider may offer a pooled application URL and
a separate direct migration URL; both point to the same database. See the
[Prisma 6 connection reference](https://www.prisma.io/docs/orm/v6/reference/prisma-config-reference).
