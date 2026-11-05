# Step 11 — Email and Password Authentication (primary), OAuth (optional)

**Goal:** make email + password the primary way to sign in, keep Google and GitHub OAuth as optional alternatives, and keep one session model so HTTP, WebSocket and Auth.js all keep working. Security is the priority: this step adds credentials, which raises the stakes of every earlier shortcut.

**Prerequisites:** Steps 01–10. **Fix first** (from the code review): trusted-proxy client IP for rate limits, closing WebSockets on session end, and stopping OAuth provider tokens being stored. Password flows are unsafe to ship without them (see 11.0).

---

## Decision record

| Question | Decision | Why |
|---|---|---|
| How do passwords create sessions? | **Own endpoints on the Node server create a `Session` row and set the same cookie Auth.js uses** | Auth.js `Credentials` provider only supports JWT sessions. The server and WebSocket gateway validate by looking up the `Session` row; JWT would break that and lose revocation |
| One session store? | Yes. Password and OAuth logins both write `Session` rows. Auth.js `auth()` accepts our rows because it reads the same cookie via the adapter | Single logout, single revocation path, no gateway changes |
| Password hashing | **Argon2id** behind a `PasswordHasher` interface; fallback `scrypt` from `node:crypto` | Argon2id is the current default recommendation. A native package needs owner approval (CLAUDE.md: no new libraries without asking), so the interface keeps scrypt available with zero dependencies |
| Email verification | **Required** before creating or joining a match | Prevents impersonation and OAuth pre-hijacking (11.7) |
| Account linking | **No automatic linking** between password and OAuth accounts in v1 | Auto-linking is the classic account-takeover path; revisit only with verified-email-on-both-sides and an authenticated "Connect" flow |
| CAPTCHA | Hook only, off by default | Add if abuse appears; needs owner decision on a provider |

### Open decisions (ask the owner before coding)
1. **D1:** Approve a native Argon2id package (for example `@node-rs/argon2`) or use scrypt.
2. **D2:** Mail provider (SMTP or an API provider) and a sender domain with SPF/DKIM.
3. **D3:** Optional server-side pepper (`PASSWORD_PEPPER`) — adds protection against a database-only leak but needs a key-rotation plan.
4. **D4:** CAPTCHA provider, if any.

---

## 11.0 Prerequisite fixes (from the review)

1. **Trusted-proxy client IP.** Add `clientIp(req)` that uses `X-Forwarded-For` only when the socket peer is the configured proxy (`TRUSTED_PROXY_IPS`), otherwise the socket address. Use it for every limiter (http, auth, WS upgrade). Without this, per-IP limits on public auth routes collapse into one global bucket.
2. **Session end closes sockets.** Peers hold their session token; a periodic check and a `sessionRevoked(userId)` hook close sockets when a session is deleted or expires. Password reset and "log out everywhere" depend on this.
3. **No stored OAuth tokens.** Wrap the Prisma adapter's `linkAccount` to drop `access_token`, `refresh_token`, `id_token`.
4. **Match write contention** (presence rewriting the match graph) is not an auth issue but will make login-time UX flaky; track it separately.

---

## Tasks

### 11.1 Data model (Prisma migration)
Extend `User`:
- `passwordHash String?` (null for OAuth-only users)
- `passwordChangedAt DateTime?`
- `emailVerifiedAt` — reuse existing `emailVerified`
- `failedLoginCount Int @default(0)`, `lastFailedLoginAt DateTime?`

New models:
- `EmailToken`: `id`, `userId`, `purpose` (`VERIFY_EMAIL | RESET_PASSWORD`), `tokenHash` (unique, SHA-256 of the raw token), `expiresAt`, `usedAt?`, `createdAt`. Indexed by `(userId, purpose)`.
- `AuthEvent`: `id`, `userId?`, `type` (`REGISTER`, `VERIFY`, `LOGIN_OK`, `LOGIN_FAIL`, `LOGOUT`, `LOGOUT_ALL`, `RESET_REQUEST`, `RESET_OK`, `PASSWORD_CHANGE`, `THROTTLED`), `ipPrefix` (truncated), `userAgent` (truncated, 200 chars), `createdAt`. No emails, passwords, or tokens.
- Session lookup keeps `sessionToken` unique. Store a **hash** of the session token in new rows? Auth.js adapter stores raw tokens; keep raw for compatibility, document the trade-off, and rely on short lifetimes and revocation.

Email is stored once, normalized: trim, NFKC, lowercase. Unique constraint on the normalized value.

### 11.2 Password service (`services/passwordService.ts`)
- `PasswordHasher` interface: `hash(plain)`, `verify(hash, plain)`, `needsRehash(hash)`. Hash string encodes algorithm and parameters.
- Argon2id parameters at or above current OWASP minimums (for example memory 19 MiB, 2 iterations, 1 lane; raise if the VPS allows). Tune so one hash takes ~100–250 ms and bound concurrent hashing (small semaphore) so login floods cannot exhaust CPU/memory.
- **Policy:** min 12, max 128 characters (reject longer before hashing), no composition rules, allow all Unicode and spaces, NFKC-normalize before hashing, reject passwords containing the email local-part, reject entries from a bundled common-password list (top ~10k, no external call). Optional later: breached-password range check.
- `needsRehash` on successful login upgrades old parameters transparently.
- Dummy hash: a precomputed valid hash used to equalize timing when the account does not exist.

### 11.3 Token service (`services/tokenService.ts`)
- 32 random bytes (`crypto.randomBytes`), base64url. Only the SHA-256 hash is stored.
- Lifetimes: verify 24 h, reset 1 h. Single use (`usedAt`). Issuing a new token for the same purpose invalidates earlier ones.
- Constant-time comparison where raw values are compared; lookups by hash.
- Purpose mismatch, expired, used, or unknown all return the same generic error.

### 11.4 Auth service (`services/authService.ts`, no HTTP knowledge)
All results are **enumeration-resistant**: same status, body, and similar timing whether or not the email exists.

- `register(email, password, name)`:
  - Validate policy. If the email is new: create user (unverified), send verification email. If the email exists: send a "someone tried to register" notice to that address (no error to the requester).
  - Always respond with the same message ("check your email").
- `verifyEmail(rawToken)`: marks verified, consumes token, logs event. Does **not** log the user in.
- `resendVerification(email)`: cooldown 60 s per email, generic response.
- `login(email, password, ctx)`:
  - Unknown email: run the dummy hash verify, return generic failure.
  - Wrong password: increment `failedLoginCount`, generic failure.
  - Unverified email: generic failure plus a "verify your email" path that does not confirm the account exists unless the password was correct.
  - Success: reset counters, rehash if needed, **rotate session**: create a new `Session` row (32 random bytes, 8 h to match current maxAge), delete any session that came in with the request.
  - Throttling: per `(email, ip)` and per IP (see 11.6). Prefer progressive delay over hard account lockout so an attacker cannot lock a victim out.
- `logout(sessionToken)`: delete the row, close that user's sockets for that session.
- `logoutEverywhere(userId)`: delete all sessions.
- `requestPasswordReset(email)`: generic response; if account exists, issue token and email it; cooldown and per-email cap.
- `resetPassword(rawToken, newPassword)`: validate policy, set hash, set `passwordChangedAt`, **delete all sessions**, consume tokens, email a "your password changed" notice, log event.
- `changePassword(userId, current, next, sessionToken)`: requires current password; keeps the current session, deletes the others.
- OAuth interplay: OAuth users have no `passwordHash`; password login for such an email fails generically. Setting a first password for an OAuth user is out of scope for v1.

### 11.5 Session cookies (`lib/sessionCookie.ts`)
- Reuse the exact names and flags already enforced for Auth.js: production `__Secure-authjs.session-token`; development `authjs.session-token`; `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, `Max-Age` equal to session lifetime.
- In production, **only** the `__Secure-` name is accepted by `resolveFromCookie` (today the plain name is also accepted; remove it).
- Logout and password reset clear the cookie with matching attributes.
- Compatibility requirement: a session created by `authService.login` must be accepted by Auth.js `auth()` and by `sessionService.resolveFromCookie`. Covered by a DB test.

### 11.6 HTTP surface, rate limits, public routes
New public routes (the router currently requires auth for every route; add an explicit per-route `access: 'public' | 'session'` field and a test that only these routes are public):

| Method | Path | Limits (per trusted client IP unless noted) |
|---|---|---|
| POST | `/api/game/auth/register` | 5/hour; per email 3/day |
| POST | `/api/game/auth/verify` | 20/hour |
| POST | `/api/game/auth/resend` | 3/hour per email; 60 s cooldown |
| POST | `/api/game/auth/login` | 10/15 min per IP; 5/15 min per `(email, IP)`; progressive delay per email |
| POST | `/api/game/auth/forgot` | 3/hour per email; 10/hour per IP |
| POST | `/api/game/auth/reset` | 10/hour |
| POST | `/api/game/auth/logout` | session required |
| POST | `/api/game/auth/logout-all` | session required |
| POST | `/api/game/auth/change-password` | session required; 5/hour |

Rules:
- Origin check applies (already enforced for non-GET). Login CSRF is covered by the Origin check plus `SameSite=Lax`.
- Strict zod schemas with size caps (email ≤ 254, password ≤ 128, name ≤ 60); unknown fields rejected.
- Tokens travel in the JSON body, never in query strings; verification and reset links land on a page that POSTs the token (the link contains the token in the URL **fragment** or a path segment that the page immediately moves to a POST body and removes from history).
- Generic error codes for all auth failures; request IDs only.
- Responses set `Cache-Control: no-store`.
- Optional CAPTCHA hook (`captchaVerify(ctx)`) on register, forgot, and after N failed logins; disabled by default.

### 11.7 OAuth as optional; pre-hijacking defense
- Keep Google and GitHub providers. They move below the email form on the sign-in page.
- Auth.js default (no auto-linking) stays: signing in with OAuth when a password account owns the email yields a clear "use your original sign-in method" message.
- **Pre-hijacking:** an attacker registers `victim@x.com` with a password (unverified). If the victim later signs in with OAuth, the attacker's password must not work. Rule: when an OAuth sign-in creates or attaches to a user whose email matches an **unverified** password account, clear that account's `passwordHash` and revoke its sessions and tokens.
- Unverified password accounts older than 7 days with no activity are purged by a daily job.

### 11.8 Email delivery (`lib/mailer.ts`)
- `Mailer` interface with `send({ to, template, data })`. Implementations: `SmtpMailer` or provider API (decision D2), `FakeMailer` for tests, `FileOutboxMailer` for local development only (writes to a gitignored folder; refused in production).
- Templates: verify email, reset password, "someone tried to register", "password changed", "new sign-in" (optional). Plain text first, minimal HTML.
- Links built from `APP_ORIGIN` only (never from request headers).
- Failures never reveal whether the account exists; failures are logged without addresses (hash the address in logs).
- Env (names only): `MAIL_FROM`, `MAIL_TRANSPORT`, `SMTP_URL` or `MAIL_API_KEY`, optional `PASSWORD_PEPPER`, `TRUSTED_PROXY_IPS`.

### 11.9 Layering (per CLAUDE.md)
- `controllers/authController.ts`: validate, call one service method, set cookies via helper.
- `services/authService.ts`, `passwordService.ts`, `tokenService.ts`: logic and policy.
- `repositories/userAuthRepository.ts`, `emailTokenRepository.ts`, `sessionWriteRepository.ts`, `authEventRepository.ts`: Prisma only.
- `lib/mailer.ts`, `lib/sessionCookie.ts`, `lib/clientIp.ts`.
- Shared zod schemas in `src/shared/validations/auth.schema.ts`; DTOs in `src/shared/dtos`.

### 11.10 UI (shadcn, mobile-first from step 10)
- **Sign-in page:** email + password form is primary; `Continue with Google` / `Continue with GitHub` below a divider ("or"). Links: Create account, Forgot password.
- **Register page:** name, email, password with live policy hints (length, not common), confirm field optional; after submit always show the same "check your email" screen.
- **Verify page:** reads the token from the link, POSTs it, shows success or generic failure with a "resend" action.
- **Forgot / Reset pages**, **Change password** (in a settings sheet), **Sessions** (log out everywhere).
- Form details: `autocomplete="email"`, `"current-password"`, `"new-password"`; `type="password"` with show/hide toggle; no password in URLs or `localStorage`; disable submit while pending; generic error text; inputs ≥16px; large touch targets; keyboard `Enter` submits; password managers work.
- Redirect after login to `/play` only (allow-list relative paths; reject absolute URLs).
- Service worker (step 10) must never cache `/api/game/auth/**`, `/signin`, `/register`, verify and reset pages.
- Server component pages require a verified email before showing `/play` actions; unverified users see a "verify your email" panel.
- Match services require `emailVerified` for create and join.

### 11.11 Logging and audit
- Log auth outcomes by event type and request ID only. Never log passwords, tokens, cookies, full emails, or reset links; add `password`, `newPassword`, `currentPassword`, `token` to redaction paths.
- `AuthEvent` rows for the events above; admin review is manual (query DB) in v1.

### 11.12 Documentation
- Update `docs/architecture.md`: auth row (email + password primary, OAuth optional), security section item 1, data model, env vars, runbook (mail DNS: SPF, DKIM, DMARC).
- `docs/auth.md`: flows, token lifetimes, rate-limit table, incident runbook (revoke all sessions, force password reset).

---

## Unit tests required (Vitest, fakes for repositories, mailer, clock)

**passwordService**
- Policy: rejects < 12 and > 128 chars; rejects common passwords and email-local-part matches; accepts long passphrases with spaces and Unicode; NFKC makes composed and decomposed forms equal.
- Hasher: hash differs per call (salt); verify true/false; `needsRehash` true for old parameters; max-length rejection happens before hashing; concurrent hashing is bounded.
- Dummy hash verify is a valid hash and takes the same code path.

**tokenService**
- Raw token never stored (only hash); expired, used, wrong-purpose, unknown all return the same error; new token invalidates previous ones; single use enforced under two concurrent consumes (exactly one wins).

**authService**
- Register: new email creates unverified user and sends exactly one verify mail; existing email sends the "attempt" notice and returns the same response; response bodies and statuses identical in both cases.
- Login: unknown email, wrong password, unverified account, OAuth-only account all return the identical generic failure; dummy hash verify is called for unknown email (spy); success creates a new session, deletes the presented one, resets counters, rehashes if needed.
- Throttle: per-email and per-IP limits trigger; progressive delay grows; a victim is not hard-locked (a correct password after the delay still works).
- Verify: marks verified once; replay fails; does not create a session.
- Reset: generic response for unknown email; valid token sets password, **revokes all sessions**, sends notice, consumes tokens; expired or reused token fails; weak new password rejected without consuming the token.
- Change password: wrong current password rejected; other sessions deleted, current kept.
- Logout deletes the row; logout-all deletes every session of the user and fires the socket-close hook.
- Pre-hijack: unverified password account + OAuth sign-in with same email clears the password, revokes sessions and tokens; verified password account + OAuth sign-in does not link and shows the original-method message.
- Match create/join rejected for unverified emails.

**Cookies and sessions**
- Cookie name, flags (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production), and `Max-Age` correct; clearing cookie uses matching attributes.
- `resolveFromCookie` accepts sessions created by `authService` and, in production, rejects the non-`__Secure-` name.
- Duplicate or malformed cookie headers never throw.

**HTTP layer**
- Public-route allow-list test: only the listed auth routes are public; every other registry entry requires a session (fails if a new route is added without classification).
- Strict schemas: unknown fields, oversize email/password/name, wrong types, `__proto__` keys rejected.
- Rate limiters key by trusted client IP (spoofed `X-Forwarded-For` from an untrusted peer ignored) and by `(email, IP)`; limits per the table.
- Origin enforced on all POST auth routes; `Cache-Control: no-store` on responses.
- Errors are generic; no timing-distinguishable branches in responses (shape equality).

**Mailer and logging**
- Links use `APP_ORIGIN` only; token appears in the email body once and nowhere else; `FileOutboxMailer` refuses production.
- Redaction test: logging objects with `password`, `newPassword`, `currentPassword`, `token`, `cookie` prints `[Redacted]`.

**Web components (Testing Library)**
- Sign-in form: correct `autocomplete` attributes, show/hide toggle, generic error text, submit disabled while pending, OAuth buttons rendered below the divider.
- Register form: policy hints update live; success state is identical for new and existing emails (same component output).
- Reset/verify pages read the token, POST it, and remove it from the address bar (`history.replaceState` spy).
- Redirect-target sanitizer rejects absolute and protocol-relative URLs.

**DB tests (`*.db.test.ts`, `npm run test:db`)**
- Unique normalized email constraint (case and Unicode variants collide).
- `EmailToken` hash uniqueness; cascade on user delete.
- A session created by the password flow is accepted by the Auth.js adapter (`getSessionAndUser`) and by `resolveFromCookie`.

## Security checks
- [ ] Prerequisite fixes (11.0) merged and tested before this step ships.
- [ ] Passwords never logged, never in URLs, never stored in plaintext or reversible form; Argon2id (or scrypt) with encoded parameters.
- [ ] Enumeration resistance verified for register, login, forgot, resend (same status, body, near-equal timing).
- [ ] Session rotation on login; all sessions revoked on reset; sockets closed on revocation.
- [ ] Verification and reset tokens: random, hashed at rest, expiring, single use, purpose-bound.
- [ ] Public auth routes rate-limited by trusted client IP and by email; global CPU protection for hashing.
- [ ] Origin check on every POST; `SameSite=Lax`; no CORS.
- [ ] No auto-linking of OAuth and password accounts; pre-hijacking test passes.
- [ ] Redirect allow-list; no open redirect after login.
- [ ] Emails built from `APP_ORIGIN`; mail failures leak nothing.
- [ ] Service worker excludes all auth routes; `no-store` on auth responses.
- [ ] Security headers unchanged or stricter (CSP without `unsafe-eval`).
- [ ] Dependency additions (hasher, mail) approved by the owner and audited.

## Exit criteria
- A new user registers with email and password, verifies by email, signs in, creates a match, and plays; sign-out, sign-in again, forgot-password and reset all work end to end (using the file outbox locally).
- Google and GitHub sign-in still work as an optional path and share the same session table.
- Password reset and "log out everywhere" end other sessions and close their sockets.
- All unit and DB tests above pass; auth services and controllers ≥ 90% coverage; full lint, typecheck, and build pass.
- `docs/auth.md` and `docs/architecture.md` updated.
