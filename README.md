# ScaleSquad

Three engineers repair CampusPass together, using private role evidence and a
deterministic three-run incident comparison.

## Layout

One root `package.json` and lockfile. Standard Next.js `src/app` layout.
All tests live together in `tests/`.

```
src/app/       Next.js App Router pages and layouts
src/server/    Controllers → services → repositories
src/shared/    Domain contracts, DTOs and strict validation schemas
src/           Components, features, simulator, scenario, DB and chat adapter
tests/         All unit, UI, network, database and Playwright tests/helpers
```

Controllers validate requests and call one service. Services own authorization
and game rules. Only repositories access Prisma. The browser never imports the
simulator, private scenario config or database. See `docs/architecture.md`.

## Local setup

1. Use Node 24 LTS and npm. Run `npm ci` at the root.
2. Copy `.env.example` to `.env` locally. Fill the database URLs. OAuth pairs are
   optional; email/password signup and login need no mail service. Use a
   random `AUTH_SECRET` of at least 32 characters. Never commit it.
3. `APP_ORIGIN` must be your exact origin, such as `http://localhost:3000`.
4. Start Postgres with `docker compose up -d`, or use an existing Postgres server.
   Compose requires `POSTGRES_USER`, a strong `POSTGRES_PASSWORD`, and `POSTGRES_DB`
   in your local environment; it deliberately supplies no password fallback.
   `DATABASE_URL` is for app queries; `DIRECT_URL` is for migrations. Both can use
   the same local connection string. Hosted pooling may require different URLs
   pointing to the same database.
5. Run `npm run db:generate` then `npm run db:migrate` with those environment
   variables available. Prisma CLI reads a root `.env`.
6. Run `npm run dev`. The custom server serves pages, `/api/game`, and `/ws`.
   Guests see the public home at `/`, then choose signup or sign in.
   Signed-in visitors continue to `/play`.
7. OAuth callbacks: `/api/auth/callback/google` and `/api/auth/callback/github` on
   `APP_ORIGIN`. Google must supply a verified email; GitHub's primary verified
   email is checked server-side.

Optional Nexconn: set both key and secret; `NEXCONN_REGION` defaults to Singapore
(`SG`; also `NA` or `SA`). Set short token validity in Nexconn Console before
live use. Without chat settings the game shows a degraded banner. No fake chat
is enabled in the application. See `src/nexconn/README.md`.

## Commands

```
npm run dev
npm run sim -- --scenario campuspass --repair reference
npm run sim -- --json
npm run lint
npm run typecheck
npm test
npm run test:cov
npm run test:db
npm run build
npm run test:e2e
npm run test:e2e:configured
npm start
```

Run database tests only against a separate database named `*_test`, after applying
migrations to that database. They create temporary test users and delete only
their own temporary match/user/auth/subscription rows. `db:seed` is optional local development tooling; it
requires `NODE_ENV=development` or `test` and never prints session tokens.

`build` uses Next's webpack build and compiles the custom server. `start` uses the
compiled server with `tsx` to resolve shared TypeScript aliases. Run commands
from the repository root. Playwright and GitHub Actions are implemented; see
`docs/e2e.md`. Fill the ignored `tests/e2e/credentials.js` for optional configured
account checks. The full game tests create disposable accounts automatically.
Deployment remains open. The worker compiles once in development and loads built JS in
production; it no longer recompiles TypeScript per simulated run.

## Match flow

Create → join with code → three ready players → private briefs → propose repair
→ normal preset run → incident preset run → new private evidence → revise repair
→ repaired run under the same incident → comparison → finish.

Runs 1 and 2 always use the original preset. Run 3 uses the saved repair.
Duplicate admissions, missed admission target, or excess budget always mean FAILED.

## Verification and external setup

See `docs/IMPLEMENTATION.md` for checks actually run and open prerequisites.
Real Google/GitHub login and Nexconn messaging require configured accounts;
automated tests use isolated sessions and a test-only chat provider.

Email/password signup, immediate login, password change and logout work without
mail. Email verification and email password recovery are removed by owner choice.
Optional Web Push still needs VAPID setup and physical-device verification.
See `docs/auth.md`, `docs/mobile-ux.md` and the readable code map in
`docs/project-flow.md`. Behind Caddy, set `TRUSTED_PROXY_IPS` to its exact socket
IP addresses so per-client limits work; keep the Node listener on loopback.
