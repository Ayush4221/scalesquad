# ScaleSquad — Agent Instructions

Read these before writing or changing any code:

1. `docs/scalesquad-deep-design.md` — game rules (Version 2 revision is authoritative). Wins on **game rules**.
2. `docs/architecture.md` — stack, structure, security, standards. Wins on **technology and structure**.

If a task conflicts with either doc, stop and ask. Do not silently deviate. If a doc needs to change, propose the edit first.

## Stack (fixed)

TypeScript strict, one root npm package, Next.js (App Router), custom Node server (`src/server`) with `ws`, Postgres + Prisma, email/password (owner-approved built-in scrypt, shared database sessions), optional Auth.js OAuth (Google, GitHub), Tailwind + shadcn/ui, Vitest, zod, pino. Nexconn for chat. Do not introduce other frameworks or libraries without asking.

Owner auth update (2026-11-05): simple signup/login without email delivery or
verification. Email password recovery is removed; password change requires the
current password. Preserve email ownership markers and default OAuth no-link
behavior. See `docs/auth.md` and `docs/project-flow.md`.

Plan 10 specifies `web-push` for Web Push; its server adapter is implemented.

Owner layout update (2026-11-04): all tests and test helpers belong in root `tests/`.
Playwright browser fixtures and the ignored common credential file live in
`tests/e2e/`; see `docs/e2e.md`. CI uses GitHub Actions. Test-only fake chat and
built-app mode require `NODE_ENV=test` and isolated `*_test` databases.
Standard Next.js `src/app` layout; all application code under root `src/`.
One root `package.json` and lockfile; shared code uses
TypeScript path aliases. This supersedes the original step-01 workspace layout.

## Layout and layers

`src/app`, `src/components`, `src/features` (View); `src/server/{controllers,services,repositories}`; `src/{sim,scenario,shared,db,nexconn}`.

Public DTOs belong in `src/shared/dtos`; reusable strict zod schemas belong in
`src/shared/validations`. Reuse those schemas across HTTP and WebSocket.

Dependency direction is one-way: `controller -> service -> repository -> db`.

- Controllers: authenticate, zod-validate, call one service, shape response. No business logic.
- Services: business rules, authorization, state machine, locks. No HTTP/WS knowledge.
- Repositories: the only code importing Prisma. No logic.
- `src/sim` is pure: no I/O, no clock, no randomness, no DB. Scenario numbers come from `src/scenario`, never hardcoded.

## Security (priority, non-negotiable)

- Server is authoritative for phase, configuration, edit lock, runs, evidence.
- Authorize in services (membership, role, lock holder, phase). Deny by default.
- Private evidence readable only by its owning user. Never in group chat, broadcasts, or logs.
- zod-validate every HTTP body and WS message. Reject unknown fields. Cap sizes.
- Verify `Origin` on state-changing routes and on WS upgrade.
- Prisma only, no raw SQL. No secrets in client bundle, logs, or commits. Env validated at boot.
- Never paste or write real credentials into code, docs, or chat. `.env.example` holds names only.
- Redact tokens, cookies, evidence in logs. Generic errors to clients.
- Every new endpoint or WS event needs authz tests (unauthenticated, non-member, wrong role, wrong phase).

## Coding standards

- `strict`, `noUncheckedIndexedAccess`; no `any`; no `console.log` (use logger).
- Typed `AppError` and one central error handler.
- Naming: `xController.ts`, `xService.ts`, `xRepository.ts`, `x.schema.ts`, `x.test.ts`.
- Small single-responsibility files.
- Do not guess Nexconn API names; read current official docs. `src/nexconn` stays interface-only until then.

## Build order

Follow design doc section 7: rules, simulator + CLI + tests, playable loop, playtest, polish. Do not build voice, AI, or extra scenarios before the core loop is playable.

## Working agreements

- Plan first, then execute, for any non-trivial change.
- Do not commit, stash, reset, branch, or use worktrees unless the user asks.
- Do not edit `docs/scalesquad-deep-design.md` game rules without explicit approval.
- Keep `docs/architecture.md` in sync when structure or stack changes.
