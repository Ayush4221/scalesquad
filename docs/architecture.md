# ScaleSquad — Architecture

Status: approved direction, pre-implementation.
Companion to `scalesquad-deep-design.md` (game rules, Version 2 revision). Where this document and the design doc disagree about **game rules**, the design doc wins. Where they disagree about **technology or structure**, this document wins.

---

## 1. Decisions summary

| Area | Decision |
|---|---|
| Language | TypeScript everywhere (`strict`) |
| Repo | Monorepo, **npm workspaces** |
| Web framework | **Next.js** (App Router) |
| Server | **Custom Node server** (`apps/server`) that mounts Next and a `ws` WebSocket gateway in one process |
| Realtime game state | WebSocket (`ws`), server-authoritative |
| Database | **PostgreSQL** (Neon or Supabase, hosted) |
| ORM | **Prisma** |
| Auth | **Auth.js (NextAuth v5)**, OAuth (Google, GitHub), Prisma adapter |
| UI | **Tailwind CSS + shadcn/ui** |
| Chat | **Nexconn** group messaging (core collaboration layer). Voice deferred |
| Private evidence | **Postgres is source of truth**, delivered via authenticated API. Nexconn DM is notification/display only until DM privacy is verified |
| Validation | zod at every boundary |
| Tests | Vitest |
| Deploy | VPS, Docker, Caddy (TLS + WS upgrade) |
| Architecture style | MVC with a service and repository layer, one-way dependencies |

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
  docs/
    scalesquad-deep-design.md
    architecture.md
  apps/
    web/                       Next.js app (View layer)
      src/app/                 routes, layouts, pages
      src/components/          UI (shadcn/ui based)
      src/features/            feature folders: lobby, brief, repair, results
      src/lib/                 API client, WS client, nexconn client wrapper
      src/auth/                Auth.js config
    server/                    Custom Node server (Controller, Service, Repository)
      src/
        config/                env.ts (zod validated at boot)
        routes/                http.ts, ws.ts
        controllers/
        services/
        repositories/
        middleware/            auth, originCheck, rateLimit, errorHandler, requestId
        ws/                    gateway.ts, rooms.ts, eventSchemas.ts
        lib/                   logger, errors, crypto
        main.ts                boots Next + HTTP + WS
      tests/
  packages/
    sim/                       Pure deterministic simulator + CLI
    scenario/                  CampusPass config JSON, zod schema, versions
    shared/                    Domain types, WS event contracts, enums
    db/                        Prisma schema, migrations, generated client
    nexconn/                   Nexconn adapter: interface + implementation
  docker-compose.yml           Local Postgres
  Dockerfile
  .env.example                 Placeholder names only, no values
  package.json                 workspaces
  tsconfig.base.json
  eslint.config.js
```

### Package responsibilities

- **`packages/sim`**: input bundle in, result out. Exports `runSimulation(bundle)`, `compareRuns(a, b)`, and a CLI that runs the three-run comparison. Imports only `scenario` and `shared`. Never touches DB, network, time, or `Math.random`.
- **`packages/scenario`**: scenario values (capacities, costs, traffic series, outage profile, deadlines) as versioned JSON plus a zod schema. No magic numbers in code (design doc 1.1).
- **`packages/shared`**: types and zod schemas shared by web and server: phases, roles, WS events, API DTOs.
- **`packages/db`**: `schema.prisma`, migrations, exported client. Only repositories import it.
- **`packages/nexconn`**: interface `ChatProvider` plus the Nexconn implementation. Server and web depend on the interface. API method names are filled in after reading current Nexconn docs (do not guess).

---

## 4. MVC mapping

| Layer | Location | Responsibility | Must not |
|---|---|---|---|
| **View** | `apps/web` | Render state, collect input | Hold authority, call DB, run simulation |
| **Controller** | `apps/server/src/controllers` | Authenticate, validate (zod), call exactly one service method, shape response | Contain business rules |
| **Service** | `apps/server/src/services` | Business logic, authorization, state machine, lock, run orchestration, evidence release | Know HTTP or WS details |
| **Repository** | `apps/server/src/repositories` | The only code that calls Prisma | Contain logic |
| **Model** | `packages/db`, `packages/shared` | Schema and domain types | Import upward |

### Dependency rule

```
controller -> service -> repository -> db
                 |
                 +-> sim, scenario, nexconn (via interface)
```

Enforced with `eslint-plugin-boundaries`. A violation fails lint and CI.

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
 | apps/server  (single Node process)            |  server-side|
 |  Next.js handler | HTTP routes | WS gateway   |  token mint,|
 |  controllers -> services -> repositories      |  notices    |
 |            |            |                     +-------------+
 |         packages/sim  packages/nexconn        |
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
Defined once in `packages/shared` as zod schemas, used by both sides.

Client to server (examples): `lock.pass`, `lock.reclaim`, `config.update`, `player.ready`, `run.start`.

Server to client (examples): `match.phase`, `config.updated`, `lock.changed`, `run.started`, `run.completed`, `evidence.available` (no content), `error`.

Rules:
- Evidence content never travels in a broadcast. `evidence.available` carries only an ID, sent to the owning user's sockets.
- Per-connection message rate limit and max payload size.
- Reconnect: client resends session, server replies with a full state snapshot filtered to what that user may see.

---

## 8. Data model (Prisma, outline)

Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`) plus:

| Model | Key fields |
|---|---|
| `Match` | id, joinCode, hostUserId, phase, scenarioVersion, engineVersion, createdAt, endedAt |
| `MatchMember` | id, matchId, userId, role (TRAFFIC/DATA/OPS), ready, joinedAt |
| `Configuration` | id, matchId, version, values (JSON), createdByUserId, createdAt |
| `ConfigurationSnapshot` | id, contentHash (unique), values (JSON) — immutable |
| `EditLock` | matchId (unique), holderUserId, expiresAt, configurationVersion |
| `SimulationRun` | id, matchId, runNumber (1-3), snapshotId, inputHash, incidentVersion, trafficProfileId, engineVersion, result (JSON), createdAt |
| `PrivateEvidence` | id, matchId, userId, phase, payload (JSON), deliveredAt |
| `AuditLog` | id, matchId, userId, action, detail (JSON), createdAt |
| `NexconnMapping` | matchId, groupChannelRef, userRefs |

Constraints:
- `(matchId, runNumber)` unique.
- `SimulationRun.inputHash` for Run 2 and Run 3 must share incident, traffic, and engine components; service asserts this before save.
- `ConfigurationSnapshot.contentHash` unique, so identical configurations reuse a row.
- Only repositories import the Prisma client.
- No raw SQL.

Env: `DATABASE_URL` (pooled) for the app, `DIRECT_URL` for migrations.

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

- `packages/nexconn` exposes a `ChatProvider` interface: create group, add member, mint user token, send server notice, fetch history. Concrete method names filled in from current official docs. Not guessed.
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
1. OAuth only (Google, GitHub) via Auth.js. We never store passwords.
2. Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, short-lived with rotation.
3. WS upgrade authenticates the session and validates `Origin`.

### Authorization
4. Checked in services, never trusted from the client: membership, role, lock holder, phase, host-only actions. Deny by default.
5. Private evidence returned only when `evidence.userId == session.userId`. Mandatory automated test: player B cannot read player A's card by any route (HTTP, WS, Nexconn).
6. Run results visible to all members; evidence content is not.

### Input and request integrity
7. zod validation on every HTTP body, query, and WS message. Unknown keys stripped. Payload size caps.
8. CSRF defence: state-changing routes verify `Origin` / `Sec-Fetch-Site`; same-site cookies.
9. Rate limits: auth, join-code attempts, WS messages per connection, run starts.
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
- No magic numbers in the simulator; all values come from `packages/scenario`.
- No `console.log`; use the logger.
- Conventional commit messages. PR checklist includes a security item (authz, validation, logging redaction).
- Commits and branches are created only when the project owner asks.

---

## 14. Testing

| Area | Requirement |
|---|---|
| Simulator | Every rule in design doc section 1 has a test: two-gate race, timeout after commit, same-key vs new-key retry, queue overload, offline gate reconnection, app/DB saturation, budget overrun, fast-but-incorrect, correct-but-slow. Determinism test: identical bundle gives identical output and hash |
| Services | Unit tests with fake repositories: state machine transitions, lock handoff, version conflicts, run snapshot equality (Run 2 vs Run 3) |
| Authorization | One test per endpoint and WS event: unauthenticated, non-member, wrong role, wrong phase. Evidence isolation test |
| Controllers | zod rejection of malformed and oversized input |
| Integration | Postgres via docker compose; full match through WS with three simulated clients |
| E2E (later) | Playwright for the three-player match |
| Security | `npm audit` clean in CI; header check test |

---

## 15. Deployment (VPS)

- Docker image builds `apps/web` and `apps/server`; runs one container.
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
NEXCONN_APP_KEY
NEXCONN_APP_SECRET
NODE_ENV
LOG_LEVEL
```

---

## 16. Build order mapping

| Step (design doc 7) | Architecture work |
|---|---|
| 1. Rules | `packages/scenario` schema and CampusPass values; rules reviewed |
| 2. Simulator | `packages/sim` with tests and CLI; no web or DB |
| 3. Playable loop | `packages/db`, auth, lobby, state machine, WS gateway, evidence API, lock, repair panel, three-run comparison, Nexconn group chat |
| 4. Playtest and tune | Deploy to VPS; tune scenario values only |
| 5. Polish | Nexconn voice, AI explanations, charts, more incidents |

---

## 17. Open items

1. Nexconn documentation link or SDK package name. The `nexconn` package stays interface-only until docs are read.
2. Verify Nexconn direct-message privacy and persistence before using DMs for anything beyond a notification.
3. Domain or subdomain for the VPS and OAuth callbacks.
4. Neon vs Supabase final pick (Prisma works with either).
5. CI provider (GitHub Actions assumed).
6. Whether Redis is needed for rate limiting. Default: in-memory limiter, sufficient for a single instance.
