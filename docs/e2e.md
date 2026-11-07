# Browser tests and CI

All tests, fixtures, local database tooling and credential helpers stay under
root `tests/`. Playwright is a root development dependency. No extra packages,
application login bypass or public seed endpoint are introduced.

## Run locally

Use Node 24. From the repository root:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

The command builds the app, applies migrations to an isolated database and starts
the real HTTP/WS server at `http://127.0.0.1:37231`. On Windows, installed
PostgreSQL 17 is used; set `PG_BIN` to another installation if needed. Otherwise,
Docker Compose starts the test-only Postgres service on loopback port 55433.
Alternatively, set `E2E_DATABASE_URL` to a dedicated `*_test` database; the runner
does not start or stop an externally supplied database.

Seeding and fake chat require `NODE_ENV=test` and database names ending `_test`.
An explicitly non-test environment is rejected. The test-only built-app flag
serves the production-built pages and worker while retaining test database
sessions. Production refuses
both test flags. Fixtures make disposable users, seed sessions directly and
delete only their own users and matches. Third-party network traffic is blocked.

The suite runs with 2 workers by default (whole files in parallel; tests inside a
file stay in order). Set `E2E_WORKERS=1` (or pass `--workers=1`) if simulation
runs time out on a slow machine.

After one build, use `npx playwright test --project=mobile-ios` (or `chromium`,
`mobile-android`) for a shorter run. `npm run test:e2e:ui` opens the runner;
`npm run test:e2e:report` opens the last HTML report. Build before UI mode if
application code changed. Reports and disposable-test diagnostics are ignored.

## Local stack smoke test

`npm run test:e2e:local` runs `tests/e2e/local/local-flow.local.ts` against
your own dev server, `.env` and database (it reuses a server already running at
`APP_ORIGIN`, or starts `npm run dev`). It refuses production and non-loopback
origins. One serial run checks:

- `/healthz`, database connectivity and that the latest migrations are applied;
- three users signing up through `/register`, then the sign-in flow (generic
  failure, success, httpOnly session cookie, sign out, sign back in);
- the squad flow: create, invalid code, join by code, three-seat roster,
  host-only start, ready, start, distinct roles and owner-only evidence;
- Squad Desk chat: members and private clues, and live Nexconn messages between
  all three users when Nexconn is configured (degraded mode otherwise);
- guest, foreign-Origin and logged-out requests being refused.

Users are named `e2e-local-<run>-…@example.invalid` and deleted with their
matches afterwards (`E2E_LOCAL_KEEP=1` keeps them). `E2E_LOCAL_BASE_URL`
overrides the target when it differs from `APP_ORIGIN`. Upstream Nexconn groups of
deleted matches are not removed. The server allows five sign-ups per hour per
IP; past that, the run creates the remaining users with the app's hasher and
reports a `sign-up rate limited` annotation. Sign-ins are limited to ten per
15 minutes per IP, so allow a pause between repeated runs.

## Common credentials file

The local **`tests/e2e/credentials.js`** file is the one place to fill user
credentials. It is ignored by Git, formatting and lint tools. A blank local file
has been prepared. On a fresh checkout, copy `credentials.example.js` to that
path, then set `baseURL` and the email/password pairs for `host`, `player2`,
`player3` and optional `outsider`. Use dedicated test accounts. Do not
put real values in the tracked example, another source file or chat.

```sh
npm run test:e2e:configured
```

This separate command signs in each configured account, checks `/play` and its
authenticated session, then signs out only the new session. It does not create
matches or reset/change account passwords. Empty entries are skipped; the
command refuses to run if no complete account or target URL is supplied. Targets
must use HTTPS or loopback HTTP. Credential requests use native fetch with generic
errors; browser traces, screenshots and video are disabled for this project.

The full game suite uses fresh disposable users automatically. It does not need
your passwords and is safe to run before filling the file. Configured-account
smoke tests do not claim live OAuth, Nexconn or Web Push coverage.

Environment values override the local file: `E2E_LIVE_BASE_URL`,
`E2E_HOST_EMAIL/PASSWORD`, `E2E_PLAYER2_EMAIL/PASSWORD`,
`E2E_PLAYER3_EMAIL/PASSWORD`, `E2E_OUTSIDER_EMAIL/PASSWORD`.

## Coverage

| Area          | Browser assertions                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lobby         | Create/join, three-player capacity, ready/start, host-only actions, leave, invalid/expired codes                                                             |
| Evidence      | Owner-only briefs, unauthorized fetches and override rejection, outbound socket/chat/audit leak checks                                                       |
| Repair        | Read-only peers, saved version, control handoff, stale-version recovery                                                                                      |
| Full match    | Three runs, Run 2 failure / Run 3 success, equal incident input hashes, finish, failed-run recovery                                                          |
| Connections   | Offline/reconnect/reload resync, disconnected-editor reclaim, logout closes/refuses sockets                                                                  |
| Password auth | Signup, immediate login, logout, change, old-password rejection, logout-all, generic failure, keyboard submit, no-verification play, removed email endpoints |
| Boundaries    | Registered routes require auth, outsider access denied, wrong role/phase, unknown config fields, bad Origin                                                  |
| Chat          | Evidence-to-draft requires intent, provider failure degrades without blocking play                                                                           |
| Mobile        | Pixel 7 and iPhone 13 browser emulation, 360px overflow, tabs, repair drawer, result cards, touch targets                                                    |
| PWA           | Desktop production-built manifest/icons, worker registration, static-only caches after full match, offline fallback, logout purge                            |

Mobile projects run all functional cases except the dedicated PWA spec.
Core fixtures block service workers so deterministic network-failure injection
cannot be bypassed by worker fetches. The dedicated PWA spec enables and tests
the real worker, including cache privacy and offline behavior. Emulation
does not establish physical-device installation, keyboard/safe-area behavior,
background push delivery or real Nexconn messaging. Those remain manual checks
in `mobile-ux.md`. Email delivery and recovery are removed by owner choice.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes and pull requests:

- Lint/format, typecheck, unit/UI/network coverage gates and production build.
- Real Postgres integration tests on a disposable `*_test` service.
- Production dependency audit and redacted full-history secret scan.
- Separate desktop, Android and iPhone Playwright jobs with seven-day reports.

Actions are pinned to commit hashes. Gitleaks uses a checksum-verified official
release. Dependabot checks root npm dependencies and Actions weekly. Browser
jobs now fail the workflow when tests fail (owner update, 2026-11-07). The
`CI required` job waits for lint/types/coverage/build, database tests, audit,
secret scan and every browser project. Failed, cancelled or skipped dependencies
fail that gate. Optional configured-account checks remain manual and are not a
required PR check. Merge-queue events also run the workflow.

Dependabot's npm and GitHub Actions version-update PRs target `development`.
GitHub still creates the PR before running its PR checks; Dependabot cannot wait
for those checks before opening it. Enforce passing CI before **merging** instead.

Repository settings are separate from workflow files. Import
`.github/rulesets/development.json` under GitHub **Settings -> Rules -> Rulesets ->
New ruleset -> Import a ruleset**, then confirm it is active. It requires the
`CI required` check from the verified GitHub Actions app (ID 15368), targets only
`development`, requires the branch to be up to date and has no bypass actors.
The JSON file is an import template; committing it does not activate protection.
If rulesets are unavailable for the repository's plan, configure equivalent
branch protection with that required check and the up-to-date requirement.

GitHub reads Dependabot configuration from the default branch. Publish this
configuration there so the scheduler can see it. Security-update PRs always use
the default branch even with `target-branch`; to send those to `development` too,
make `development` the default branch in repository settings. This also changes
the default base for other PRs, so it is not silently changed by this patch.
Existing PRs are not retargeted by this file edit. See GitHub's
[Dependabot branch rules](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch)
and [required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-status-checks-to-pass-before-merging).

The optional manual `configured_users` workflow input runs the account smoke
checks using the `test-accounts` GitHub environment. Set `E2E_LIVE_BASE_URL` as an
environment variable and the account pairs above as environment **secrets**.
Those secrets are available only to that manual test step. It uploads no reports,
traces, screenshots, outbox files or databases. Normal PR jobs need no account
secrets. The workflow must be committed/pushed before GitHub can run it.

Failure-injection checks assert the message shown to the player, not the mocked
backend diagnostic. A JSON 503 produces the generic service-unavailable message;
sign-in distinguishes an outage from invalid credentials. Keep those assertions
separate and verify private diagnostics never appear in the page. Scope error
locators to `main` so Next.js's route announcer is not matched as another alert.
