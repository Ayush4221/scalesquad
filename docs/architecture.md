# ScaleSquad — Architecture

Status: steps 01–09 and the review fixes are implemented locally. Steps 10–11 code is present; mail is removed by owner choice. VAPID configuration and real-device checks remain open. Verification is tracked in `IMPLEMENTATION.md`.
Companion to `scalesquad-deep-design.md` (game rules, Version 2 revision). Where this document and the design doc disagree about **game rules**, the design doc wins. Where they disagree about **technology or structure**, this document wins.

---

## 1. Decisions summary

| Area                | Decision                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language            | TypeScript everywhere (`strict`)                                                                                                                                                                                                                                                         |
| Repo                | Single npm package; one root `package.json` and lockfile. App and shared-code folders are organized by responsibility                                                                                                                                                                    |
| Web framework       | **Next.js** (App Router)                                                                                                                                                                                                                                                                 |
| Server              | **Custom Node server** (`src/server`) that mounts Next and a `ws` WebSocket gateway in one process                                                                                                                                                                                       |
| Realtime game state | WebSocket (`ws`), server-authoritative                                                                                                                                                                                                                                                   |
| Database            | **PostgreSQL** (Neon or Supabase, hosted)                                                                                                                                                                                                                                                |
| ORM                 | **Prisma**                                                                                                                                                                                                                                                                               |
| Auth                | **Email + password (primary, own endpoints, database sessions)**; **Auth.js (NextAuth v5)** OAuth (Google, GitHub) optional; one `Session` table. See `plan/11-email-password-auth.md`                                                                                                   |
| UI                  | **Tailwind CSS + shadcn/ui**                                                                                                                                                                                                                                                             |
| Chat                | **Nexconn** group messaging (core collaboration layer). Voice deferred                                                                                                                                                                                                                   |
| Private evidence    | **Postgres is source of truth**, delivered via authenticated API. Nexconn DM is notification/display only until DM privacy is verified                                                                                                                                                   |
| Validation          | zod at every boundary                                                                                                                                                                                                                                                                    |
| Tests               | Vitest                                                                                                                                                                                                                                                                                   |
| Mobile              | **PWA first** (Android, iOS, desktop from one Next.js codebase): manifest, security-safe service worker (static assets only, never API/evidence), content-free Web Push, mobile-first UI. Native app only if push or store presence proves necessary. See `plan/10-pwa-and-mobile-ui.md` |
| Deploy              | VPS, Docker, Caddy (TLS + WS upgrade)                                                                                                                                                                                                                                                    |
| Architecture style  | MVC with a service and repository layer, one-way dependencies                                                                                                                                                                                                                            |

---

## 2. Principles

1. **Server is authoritative.** Phase, configuration, edit lock, run inputs, evidence release. The client never decides.
2. **The simulator is a pure function.** No I/O, no clock, no randomness. Same input bundle, same output.
3. **Security by default.** Deny by default, validate every input, authorize in the service layer.
4. **Thin controllers, fat services, dumb repositories.**
5. **Nexconn and game state are separate streams.** A chat message may announce a change; only the server persists it.
6. **Build the game loop before the polish.** Order: rules, simulator CLI, playable loop, playtest, polish (design doc section 7).

---

## 3. Repository layout

```
scalesquad/
  src/
    app/                       Next.js App Router pages, layouts and Auth.js route
    components/ui/             shadcn/ui components
    features/                  lobby, briefs, repair, results and chat
    lib/                       browser API, WebSocket and Nexconn clients
    auth/                      server-only Auth.js configuration
    proxy.ts                   Next.js route protection convenience layer
    server/
      controllers/             request validation and service delegation
      services/                authorization and game rules
      repositories/            Prisma persistence only
      routes/                  HTTP routing
      middleware/              origin, body size, rate limits and safe errors
      ws/                      authenticated gateway and membership-checked rooms
      config/                  validated server environment
      lib/                     domain ports, persistence interfaces and workers
      main.ts                  custom Node server mounting Next and WebSocket
    shared/
      dtos/                    public request and response transfer types
      validations/             strict zod request schemas, shared by HTTP and WS
      domain.ts                domain enums and validated response shapes
      events.ts                versioned WebSocket envelopes
    sim/                       pure deterministic simulator and developer CLI
    scenario/                  versioned CampusPass values and private evidence
    db/prisma/                 schema and checked-in migrations
    nexconn/                   chat provider interface and documented adapter
  tests/                       all unit, UI, network and database tests/helpers
  public/                      static public assets (Next.js convention)
  docs/
  package.json                 single dependency manifest
  package-lock.json            single lockfile
  next.config.ts
  postcss.config.mjs
  components.json              shadcn metadata
  tsconfig.json
  tsconfig.base.json
  tsconfig.server.json
  vitest.config.ts
  vitest.db.config.ts
  eslint.config.js
  docker-compose.yml
  .env.example
```

### Package responsibilities

- **`src/sim`**: input bundle in, result out. Exports `runSimulation(bundle)`, `compareRuns(a, b)`, and a CLI that runs the three-run comparison. Imports only `scenario` and `shared`. Never touches DB, network, time, or `Math.random`.
- **`src/scenario`**: scenario values (capacities, costs, traffic series, outage profile, deadlines) as versioned JSON plus a zod schema. No magic numbers in code (design doc 1.1).
- **`src/shared`**: types and zod schemas shared by web and server: phases, roles, WS events, API DTOs.
- **`src/db`**: `schema.prisma`, migrations, exported client. Only repositories import it.
- **`src/nexconn`**: interface `ChatProvider` plus the Nexconn implementation. Server and web depend on the interface. API method names are filled in after reading current Nexconn docs (do not guess).

---

## 4. MVC mapping

| Layer          | Location                                    | Responsibility                                                                          | Must not                                |
| -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| **View**       | `src/app`, `src/components`, `src/features` | Render state, collect input                                                             | Hold authority, call DB, run simulation |
| **Controller** | `src/server/controllers`                    | Authenticate, validate (zod), call exactly one service method, shape response           | Contain business rules                  |
| **Service**    | `src/server/services`                       | Business logic, authorization, state machine, lock, run orchestration, evidence release | Know HTTP or WS details                 |
| **Repository** | `src/server/repositories`                   | The only code that calls Prisma                                                         | Contain logic                           |
| **Model**      | `src/db`, `src/shared`                      | Schema and domain types                                                                 | Import upward                           |

### Dependency rule

```
controller -> service -> repository -> db
                 |
                 +-> sim, scenario, nexconn (via interface)
```

Enforced with `eslint-plugin-boundaries`. A violation fails lint and CI.

### Owner-requested layout update (2026-11-04)

Use the standard single-project Next.js `src/app` structure. All application
code lives under root `src/`; root `public/`, config and `.env` follow Next's
conventions. There is one root `package.json` and lockfile. All tests and test
helpers live under root `tests/`. Shared imports use TypeScript path aliases.
This supersedes the older workspace and colocated-test paths in the step docs.

Request DTOs are inferred from strict schemas in `src/shared/validations` and
exported from `src/shared/dtos`. HTTP controllers and WS envelopes reuse those
same schemas. Services receive validated values and own all authorization.
Private evidence queries include both match ID and authenticated owner ID.

### Request flow (example: change configuration)

1. Client sends `config.update` over WS (or `POST /api/matches/:id/config`).
2. Middleware: session check, origin check, rate limit, request ID.
3. Controller: zod-parse payload; reject unknown fields.
4. `configService.update(userId, matchId, change, expectedVersion)`:
   - Is the user a member of this match?
   - Is the user the current edit-lock owner?
   - Is the phase one that allows editing?
   - Is the match not simulation-locked?
   - Is every field value in the allowed option set?
   - Transaction: compare `configurationVersion`, apply, increment, write audit row.
5. Gateway broadcasts `config.updated` (new version) to the match room.
6. View re-renders from the broadcast.

---

## 5. Runtime architecture

```
 Browser (Next.js UI, shadcn)
   |  HTTPS (pages, API)        |  WSS (game state)        |  Nexconn SDK (chat)
   v                            v                          v
 +-----------------------------------------------+    +----------------+
 | Caddy (TLS, HSTS, WS upgrade)                 |    | Nexconn cloud  |
 +----------------------+------------------------+    +--------^-------+
                        |                                      |
 +----------------------v------------------------+             |
 | src/server  (single Node process)            |  server-side|
 |  Next.js handler | HTTP routes | WS gateway   |  token mint,|
 |  controllers -> services -> repositories      |  notices    |
 |            |            |                     +-------------+
 |         src/sim  src/nexconn        |
 +----------------------+------------------------+
                        |
                 Prisma | TLS
                        v
              Postgres (Neon or Supabase)
```

Single instance means one in-memory room map is valid. State is still written through to Postgres so a restart recovers matches. If we ever scale out, replace the room map with pub/sub; the service layer does not change.

---

## 6. Match state machine

Server-owned. Timers server-side. Transitions validated; illegal transitions rejected.

```
LOBBY
  -> BRIEFING            (3 roles filled, all ready)
  -> REPAIR_1            (briefs read, discussion, first configuration)
  -> RUNS_1_2            (config locked; Run 1 normal, Run 2 incident, same preset)
  -> INCIDENT_EVIDENCE   (new private evidence delivered)
  -> REPAIR_2            (second configuration)
  -> RUN_3               (config locked; same incident + traffic as Run 2)
  -> COMPARE
  -> FINISHED
```

Rules enforced in `matchService`:

- Match cannot leave `LOBBY` with a missing role.
- Configuration is read-only during `RUNS_1_2` and `RUN_3`.
- Run 3 reuses the exact incident, timing, traffic series, outage window, retry pattern, and engine version of Run 2. Only configuration differs. Verified by comparing content hashes before saving.

---

## 7. Realtime (WebSocket)

### Connection

- Upgrade request validates the Auth.js session cookie **and** the `Origin` header before accepting. Unauthenticated upgrade is rejected with 401.
- A connection joins a match room only after membership is checked.

### Event contracts

Defined once in `src/shared` as zod schemas, used by both sides.

Client to server (examples): `lock.pass`, `lock.reclaim`, `config.update`, `player.ready`, `run.start`.

Server to client (examples): `match.phase`, `config.updated`, `lock.changed`, `run.started`, `run.completed`, `evidence.available` (no content), `error`.

Rules:

- Evidence content never travels in a broadcast. `evidence.available` carries only an ID, sent to the owning user's sockets.
- Per-connection message rate limit and max payload size.
- Reconnect: client resends session, server replies with a full state snapshot filtered to what that user may see.

---

## 8. Data model (Prisma, outline)

Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`) plus:

| Model                   | Key fields                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Match`                 | id, joinCode, hostUserId, phase, scenarioVersion, engineVersion, createdAt, endedAt                                             |
| `MatchMember`           | id, matchId, userId, role (TRAFFIC/DATA/OPS), ready, joinedAt                                                                   |
| `Configuration`         | id, matchId, version, values (JSON), createdByUserId, createdAt                                                                 |
| `ConfigurationSnapshot` | id, contentHash (unique), values (JSON) — immutable                                                                             |
| `EditLock`              | matchId (unique), holderUserId, expiresAt, configurationVersion                                                                 |
| `SimulationRun`         | id, matchId, runNumber (1-3), snapshotId, inputHash, incidentVersion, trafficProfileId, engineVersion, result (JSON), createdAt |
| `PrivateEvidence`       | id, matchId, userId, phase, payload (JSON), deliveredAt                                                                         |
| `AuditLog`              | id, matchId, userId, action, detail (JSON), createdAt                                                                           |
| `NexconnMapping`        | matchId, groupChannelRef, userRefs                                                                                              |

Constraints:

- `(matchId, runNumber)` unique.
- `SimulationRun.inputHash` for Run 2 and Run 3 must share incident, traffic, and engine components; service asserts this before save.
- `ConfigurationSnapshot.contentHash` unique, so identical configurations reuse a row.
- Only repositories import the Prisma client.
- No raw SQL.

Env: `DATABASE_URL` for app queries, `DIRECT_URL` for migrations. Both may use
the same direct connection string locally. Hosted pooling may provide different
URLs for the same database.

---

## 9. Simulator contract

```
runSimulation(bundle: InputBundle): SimulationResult
```

`InputBundle` (immutable, hashed): scenario version, configuration, traffic profile, incident profile, retry policy, engine version.

`SimulationResult` returns every field listed in design doc 1.8 (`validAdmissions`, `duplicateAdmissions`, ... `failureReasons[]`). Each failure reason is machine-readable: `{ code, rule, evidence, causedBy }`.

Hard gates (design doc section 3): no duplicates, minimum valid admissions by deadline, budget. Diagnostic score only after the gates, and never makes a failed run look like a win.

CLI: `npm run sim -- --scenario campuspass --config preset.json` prints the three-run comparison. This is the Step 2 exit test and requires no UI.

---

## 10. Nexconn integration

- `src/nexconn` exposes a `ChatProvider` interface: create group, add member, mint user token, send server notice, fetch history. Concrete method names filled in from current official docs. Not guessed.
- Server creates the group on match creation and stores the mapping.
- Server mints a short-lived Nexconn token per authenticated user. App secret is server-only.
- Group chat carries player discussion and structured game notices (phase changes, run completed). Notices contain no private content.
- Private evidence: stored in Postgres; user fetches via `GET /api/matches/:id/evidence` authorized by `userId`. Nexconn DM, if verified private and persistent, may carry a "new evidence card" ping only. Promote to full content only after verification and a leak test.
- If Nexconn is unreachable, the game still functions; chat shows a degraded banner.
- Voice: out of scope until the core loop is proven.

---

## 11. Edit lock and simulation lock

- One editor at a time. Holder stored in `EditLock`.
- `lock.pass`: holder names another member; server updates holder and broadcasts.
- `lock.reclaim`: host only, only after the holder has been disconnected past a timeout.
- Every accepted change increments `configurationVersion`; updates carry an expected version, mismatch is rejected (optimistic concurrency inside a transaction).
- `run.start` is idempotent: keyed by `(matchId, runNumber)`. On start the server snapshots the configuration, records all input hashes, sets the match simulation-locked, runs, then unlocks.

---

## 12. Security

### Identity and sessions

1. Email + password (owner-approved built-in scrypt, no email verification, rate-limited, enumeration-resistant) is primary; OAuth (Google, GitHub via Auth.js) is optional. Both create the same database `Session` rows. See `auth.md` for the current owner-approved flow.
2. Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, short-lived with rotation.
3. Game WS upgrade authenticates the session and validates `Origin`. Each outgoing push rechecks the session; periodic checks close idle expired sessions. Revocation hooks close the exact session or all user sessions immediately. Unused OAuth provider tokens are discarded before persistence and old token values are purged on startup.

Development HTML permits React's debugging `eval` requirement. Production and
built-test pages do not. Only the exact `/_next/hmr` upgrade with matching Host
and Origin is left to Next's reload handler in development. Production rejects
that path; `/ws` always keeps its session checks. Form inputs remain disabled
until hydration completes so early typing is not discarded.

### Authorization

4. Checked in services, never trusted from the client: membership, role, lock holder, phase, host-only actions. Deny by default.
5. Private evidence returned only when `evidence.userId == session.userId`. Mandatory automated test: player B cannot read player A's card by any route (HTTP, WS, Nexconn).
6. Run results visible to all members; evidence content is not.

### Input and request integrity

7. Strict zod validation on every HTTP body, query, and WS message. Unknown keys rejected. Payload size caps. Public request DTOs and reusable schemas live in `src/shared/dtos` and `src/shared/validations`.
8. CSRF defence: state-changing routes verify `Origin` / `Sec-Fetch-Site`; same-site cookies.
9. Rate limits: auth, join-code attempts, WS messages per connection, run starts. Client IP comes from the socket unless the peer is in `TRUSTED_PROXY_IPS`; only then is the forwarding chain trusted. Match creation is serialized per host, capped at three active hosted matches and ten creations/day. Active membership is capped at ten matches/user, before provisioning chat access.
10. Join codes: high entropy, expire, invalid once the match starts.

### Data and secrets

11. Secrets in env only, validated at boot with zod, server exits if missing or malformed. `.env.example` has names only. Real secrets never committed, never pasted into chat or docs.
12. Nexconn app secret and OAuth secrets are server-only; never in the client bundle.
13. Prisma only, parameterized queries, no raw SQL. Least-privilege DB role. TLS to Postgres.

### Transport and headers

14. Caddy terminates TLS, HSTS enabled. WS over WSS only.
15. Strict CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`. Set in Next headers and Caddy.

### Logging and errors

16. Structured logs (pino) with request IDs. Redaction list: tokens, cookies, evidence payloads, secrets.
17. Clients get generic error codes. No stack traces or internals.
18. Audit rows for configuration changes, lock handoffs, run starts.

### Supply chain and deployment

19. Committed lockfile, `npm audit` in CI, Dependabot, pinned versions.
20. Docker image runs as non-root, minimal base image, no dev dependencies in production.
21. DB reachable only over TLS from the VPS. No public admin endpoints.

---

## 13. Coding standards

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `any` is a lint error.
- ESLint + Prettier enforced in CI. Pre-commit runs lint and type-check on staged files.
- Boundary rules via `eslint-plugin-boundaries` (section 4).
- One typed error class `AppError { code, httpStatus, safeMessage }`; one central error handler.
- Naming: `xController.ts`, `xService.ts`, `xRepository.ts`, `x.schema.ts` (zod), `x.test.ts`.
- Small files, one responsibility. No business logic in controllers or components.
- No magic numbers in the simulator; all values come from `src/scenario`.
- No `console.log`; use the logger.
- Conventional commit messages. PR checklist includes a security item (authz, validation, logging redaction).
- Commits and branches are created only when the project owner asks.

---

## 14. Testing

| Area          | Requirement                                                                                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulator     | Every rule in design doc section 1 has a test: two-gate race, timeout after commit, same-key vs new-key retry, queue overload, offline gate reconnection, app/DB saturation, budget overrun, fast-but-incorrect, correct-but-slow. Determinism test: identical bundle gives identical output and hash |
| Services      | Unit tests with fake repositories: state machine transitions, lock handoff, version conflicts, run snapshot equality (Run 2 vs Run 3)                                                                                                                                                                 |
| Authorization | One test per endpoint and WS event: unauthenticated, non-member, wrong role, wrong phase. Evidence isolation test                                                                                                                                                                                     |
| Controllers   | zod rejection of malformed and oversized input                                                                                                                                                                                                                                                        |
| Integration   | Postgres via docker compose; full match through WS with three simulated clients                                                                                                                                                                                                                       |
| E2E           | Playwright for the three-player match                                                                                                                                                                                                                                                                 |
| Security      | `npm audit` clean in CI; header check test                                                                                                                                                                                                                                                            |

---

### Playwright and CI implementation

Root `playwright.config.ts` runs desktop Chromium, Pixel 7 Chromium and iPhone 13
WebKit against production-built pages and the real HTTP/WS server. Every fixture
and helper stays in `tests/e2e`. Direct session seeding and fake chat refuse any
environment except `NODE_ENV=test` with isolated `*_test` databases. A test-only
built-app flag enables production-build PWA checks without production sessions. Production boot rejects these flags. There is no test login endpoint.

Controlled lobby/auth forms stay disabled until hydration so early input is not
lost. The private common `tests/e2e/credentials.js` supports optional account
smoke checks; full-match tests instead create disposable accounts. Credentials
are never recorded in traces or uploaded as artifacts. See `e2e.md` for coverage,
local setup and remaining physical-device/live-provider checks.

GitHub Actions checks root lint, types, coverage, database integrations, build,
production dependency audit and redacted secret scanning. Separate browser jobs
are initially advisory per plan 12. Actions are commit-pinned; Dependabot checks
npm and Actions weekly. Manual configured-account checks use environment secrets
and upload no artifacts.

## 15. Deployment (VPS)

- Docker image builds `src/app`, `src/components`, `src/features` and `src/server`; runs one container.
- docker compose on the VPS: `app` + `caddy`. Postgres is external (Neon or Supabase).
- Caddy: automatic TLS, reverse proxy to the app, WS upgrade, security headers.
- OAuth production callbacks point at the VPS domain (domain or subdomain required).
- Migrations: `prisma migrate deploy` using `DIRECT_URL`, run at release time, not at app boot.
- Health endpoint `/healthz` for the proxy and monitoring.
- Single instance. Restart recovers active matches from Postgres.

### Environment variables (names only)

```
DATABASE_URL
DIRECT_URL
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
APP_ORIGIN
TRUSTED_PROXY_IPS
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEXCONN_APP_KEY
NEXCONN_APP_SECRET
NODE_ENV
LOG_LEVEL
```

Mail setup is removed by owner decision. VAPID fields are optional, validated
together and server-only
apart from the authenticated public-key response. Pepper
and CAPTCHA are off by owner decision. Never put their secrets in public env vars.

### Current password flow (owner update 2026-11-05)

Signup → sign in → play. No email verification, mail provider or email recovery
is required. Password changes use the current password in Settings. Password
accounts retain an unverified email marker; matching email text never enables
OAuth account linking. OAuth cannot delete or replace a password account. The
unverified-account purge is removed. See `auth.md` and `project-flow.md`.

### Steps 10–11 implementation notes

`src/pwa` owns the install hooks and static-cache policy; root `public` holds
generated icons, the static offline shell and the generated worker. Build inlines
the tested cache rules; registration is production-only. API/auth/RSC/private
pages are never cached. See `mobile-ux.md` for responsive rules and device status.

`AuthEvent` and `PushSubscription` support authentication and notifications.
The historical `EmailToken` table/migration remains for compatibility, with no
active issuing or consuming code.
Push subscriptions are owner-bound and capped at five per user. Notification
payloads contain only kind and match ID; fixed text lives in the worker.

Presence writes update membership timestamps and a live holder lease directly,
without rewriting the aggregate or changing its revision. Serializable game
transactions retry serialization conflicts at most twice. The timer queries only
bounded due match IDs; a separate bounded sweep closes matches with no member
activity for 30 minutes and retries deletion of finished Nexconn groups.
Finished groups awaiting deletion still reserve a host quota slot, bounding
external groups when provider cleanup is failing.

Production simulation workers load compiled JavaScript. Development compiles
the engine once per server process. Untraced runs privately own cumulative state;
the public step/trace API remains immutable. One root package/config owns all of
this code, with every test and helper in the root `tests` tree.

---

## 16. Build order mapping

| Step (design doc 7)  | Architecture work                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1. Rules             | `src/scenario` schema and CampusPass values; rules reviewed                                                                  |
| 2. Simulator         | `src/sim` with tests and CLI; no web or DB                                                                                   |
| 3. Playable loop     | `src/db`, auth, lobby, state machine, WS gateway, evidence API, lock, repair panel, three-run comparison, Nexconn group chat |
| 4. Playtest and tune | Deploy to VPS; tune scenario values only                                                                                     |
| 5. Polish            | Nexconn voice, AI explanations, charts, more incidents                                                                       |

---

## 17. Open items

1. Nexconn docs and installed SDK types reviewed; real adapter implemented. Live messaging still needs configured credentials.
2. Verify Nexconn direct-message privacy and persistence before using DMs for anything beyond a notification.
3. Domain or subdomain for the VPS and OAuth callbacks.
4. Neon vs Supabase final pick (Prisma works with either).
5. CI provider resolved: GitHub Actions; first remote run awaits owner push.
6. Whether Redis is needed for rate limiting. Default: in-memory limiter, sufficient for a single instance.
