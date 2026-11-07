# ScaleSquad — Implementation Plan

Twelve steps, executed in order. Each step is a self-contained doc with tasks, files, required unit tests, security checks, and exit criteria. Do not start step N+1 until step N exit criteria pass.

Sources of truth: `../scalesquad-deep-design.md` (game rules), `../architecture.md` (stack and structure), `../../CLAUDE.md` (working agreements).

Owner-requested follow-up (2026-11-07): [Step 13 — Squad voice BETA](13-squad-voice-beta.md)
requires steps 01–12 and the core-loop playtest gate. It is split into
[13a provider proof](13a-voice-provider-proof.md) (1–2 developer days) and
[13b build](13b-squad-voice-build.md) (6–9 developer days after GO).
Implementation and the new SDK package are not enabled by these planning docs.

Owner layout update (2026-11-04): use one root `package.json`, no npm workspaces,
the standard Next.js `src/app` layout with all app code under root `src/`,
and one shared root `tests/` tree. These explicit
instructions supersede the older workspace and colocated-test paths below.
Current paths are listed in `../architecture.md`.

| # | Doc | Outcome |
|---|---|---|
| 01 | [Workspace scaffold](01-workspace-scaffold.md) | Next.js via template, shadcn/ui, monorepo folders, lint, Vitest |
| 02 | [Contracts and scenario](02-contracts-and-scenario.md) | Shared types, zod schemas, CampusPass config v1 |
| 03 | [Simulator core](03-simulator-core.md) | Pure rules engine, heavy unit tests |
| 04 | [Simulator runs and CLI](04-simulator-runs-and-cli.md) | Hard gates, three-run comparison, CLI, determinism |
| 05 | [Database and auth](05-database-and-auth.md) | Prisma schema, Postgres, OAuth sessions |
| 06 | [Server and WebSocket](06-server-and-websocket.md) | Custom server, middleware, authenticated WS gateway |
| 07 | [Match lifecycle and lobby](07-match-lifecycle-and-lobby.md) | State machine, join codes, roles, Nexconn group chat |
| 08 | [Evidence, lock, repair](08-evidence-lock-repair.md) | Private evidence, edit lock, repair controls |
| 09 | [Runs and results](09-runs-and-results.md) | Run orchestration, incident phase, comparison UI |
| 10 | [PWA and mobile UI](10-pwa-and-mobile-ui.md) | Installable Android/iOS app, safe service worker, Web Push, mobile-first UI |
| 11 | [Email and password auth](11-email-password-auth.md) | Email + password primary, OAuth optional, verification, reset, session revocation |
| 12 | [Hardening, E2E, deploy](12-hardening-e2e-deploy.md) | Security pass, Playwright (desktop + mobile), VPS deploy, playtest |

## Global conventions

- **Unit tests are the priority.** Every service, middleware, and simulator rule ships with Vitest tests in the same step. Playwright is last (step 12) and not blocking earlier steps.
- Test file sits next to the unit: `foo.ts` and `foo.test.ts`. Backend integration tests needing Postgres use `*.db.test.ts`, run by `npm run test:db`.
- Coverage targets (v8): `src/sim` 100% lines and branches on rule code; services 90%+; middleware 90%+; controllers 80%+.
- Every new endpoint or WS event needs an authorization test matrix: unauthenticated, non-member, wrong role, wrong phase.
- No commits, branches, or worktrees unless the project owner asks.
- No real secrets in code, docs, tests, or chat. Placeholder names only.
- If a step conflicts with the design or architecture doc, stop and ask.

## Definition of done (every step)

1. `npm run lint` clean.
2. `npm run typecheck` clean.
3. `npm test` passes, coverage targets met for touched code.
4. `npm run build` passes (from step 01 onward).
5. Security checklist in the step doc ticked.
6. `docs/architecture.md` updated if structure or stack changed.

## Root scripts (created in step 01)

```
npm run dev          web + server dev
npm run build
npm run lint
npm run typecheck
npm test             all unit tests
npm run test:watch
npm run test:cov
npm run test:db      DB-backed tests (needs docker compose up)
npm run test:e2e     Playwright (step 12)
npm run sim          simulator CLI (step 04)
```
