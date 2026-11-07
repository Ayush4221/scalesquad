# Step 05 — Database and Authentication

**Goal:** Prisma schema on Postgres, repository base, and OAuth login (Google, GitHub) via Auth.js with database sessions that the custom server can also validate.

**Prerequisites:** Step 01 (compose, env), Step 02 (shared types). Simulator (03–04) can be done in parallel but must be done before step 09.

---

## Tasks

### 5.1 Postgres and Prisma
1. `docker compose up -d` starts local Postgres (localhost only).
2. In `packages/db`: install `prisma` (dev) and `@prisma/client`.
3. `schema.prisma` with `datasource` using `DATABASE_URL` and `directUrl = env("DIRECT_URL")`.
4. Models (see architecture section 8):
   - Auth.js: `User`, `Account`, `Session`, `VerificationToken`.
   - Game: `Match`, `MatchMember`, `Configuration`, `ConfigurationSnapshot`, `EditLock`, `SimulationRun`, `PrivateEvidence`, `AuditLog`, `NexconnMapping`.
5. Constraints and indexes:
   - `Match.joinCode` unique, indexed.
   - `MatchMember` unique `(matchId, userId)` and unique `(matchId, role)`.
   - `SimulationRun` unique `(matchId, runNumber)`.
   - `ConfigurationSnapshot.contentHash` unique.
   - `PrivateEvidence` unique `(matchId, userId, phase)`; index `(userId)`.
   - `EditLock.matchId` unique.
   - Foreign keys with `onDelete: Cascade` only where safe (match children).
6. Enums mirrored from `shared` (`Role`, `MatchPhase`); a test asserts Prisma enums equal shared enums.
7. `npx prisma migrate dev --name init`; commit-ready migration files stay in repo.
8. Export a single `prisma` client factory (singleton, handles hot reload in dev) from `packages/db`.

### 5.2 Repository base (`apps/server/src/repositories`)
- `BaseRepository` accepts an injected `PrismaClient | TransactionClient` so services can run multiple repo calls in one transaction.
- Provide `withTransaction(fn)` helper in a `unitOfWork.ts`.
- Create thin repositories needed now: `userRepository`, `sessionRepository` (lookup by session token). Match/evidence repos arrive in steps 07–09.
- Repositories return plain domain objects (mapped), not leaked Prisma types where avoidable.

### 5.3 Environment validation
- `apps/server/src/config/env.ts`: zod schema for every env var; `process.exit(1)` with a redacted message on failure. Export a typed frozen `env`.
- `apps/web` has its own `src/lib/env.ts` for the few vars it reads (`APP_ORIGIN`, auth ids). Secrets only in server-side code.

### 5.4 Auth.js (NextAuth v5) in `apps/web`
- Install `next-auth@beta` (v5) and `@auth/prisma-adapter`.
- `src/auth/index.ts`: providers Google and GitHub; `PrismaAdapter` using the shared client; `session: { strategy: "database" }` so the Node server can validate the cookie by looking up the `Session` row.
- `trustHost` only when `APP_ORIGIN` matches; cookies: `HttpOnly`, `Secure` in production, `SameSite=Lax`.
- Route handler `app/api/auth/[...nextauth]/route.ts`.
- Pages: `/signin` (shadcn Card with two provider buttons), `/` redirects authenticated users to `/play`.
- Next `middleware.ts` protects `/play/**` and `/match/**` (redirect to signin). Middleware is a convenience only; the server re-checks.
- Callback `signIn`: allow only verified-email providers; reject accounts without an email.
- Session callback exposes `userId` and display name only. No tokens to the client.
- `getCurrentUser()` helper for server components.

### 5.5 Session lookup for the custom server
- `sessionService.resolveFromCookie(cookieHeader)` in `apps/server`: parse the Auth.js session cookie name (secure and non-secure variants), look up `Session` where `expires > now`, return `{ userId, name }` or null.
- Used by HTTP middleware (step 06) and WS upgrade (step 06).

### 5.6 Seeds (dev only)
- `prisma/seed.ts` creating three test users and sessions for **local dev and Playwright only**; refuses to run when `NODE_ENV=production`.

---

## Unit tests required
- **Env schema**: valid passes; each missing/invalid var fails with a message that contains the var name but not the value; production requires `AUTH_SECRET` length ≥ 32; `APP_ORIGIN` must be https in production.
- **Enum parity**: Prisma enums equal `shared` enums (catches drift).
- **sessionService.resolveFromCookie** (fake repo): valid cookie → user; expired → null; unknown token → null; malformed cookie header → null; secure-prefixed cookie name handled; no cookie → null; never throws on garbage input.
- **unitOfWork**: callback error rolls back (fake client records rollback); success commits.
- **Auth callbacks** (pure functions extracted for testing): signIn rejects missing email, accepts verified; session callback returns only `userId` and `name`.
- **DB tests (`*.db.test.ts`, `npm run test:db`)**: migrations apply on empty DB; unique constraints reject duplicate `(matchId, role)`, duplicate join code, duplicate `(matchId, runNumber)`; cascade delete of match removes children.

## Security checks
- [ ] OAuth secrets only in server env; never exposed via `NEXT_PUBLIC_*`.
- [ ] Session cookie flags verified (test inspects `Set-Cookie` options in config).
- [ ] Database sessions: logout deletes the row.
- [ ] Callback URL allow-list: only `APP_ORIGIN`.
- [ ] Seed script blocked in production.
- [ ] DB user for the app is least-privilege (document the SQL for creating it on Neon/Supabase; migrations use `DIRECT_URL` owner role).
- [ ] No raw SQL anywhere (`$queryRaw`/`$executeRaw` banned by lint rule).
- [ ] `AuditLog` table exists but contains no secrets or evidence content by design.

## Exit criteria
- Sign in with Google and GitHub works locally; session row appears in DB; sign out removes it.
- Unauthenticated access to `/play` redirects to `/signin`.
- `resolveFromCookie` returns the same user as Auth.js for a real cookie.
- `npm test` and `npm run test:db` green; env validation fails fast on a bad `.env`.
