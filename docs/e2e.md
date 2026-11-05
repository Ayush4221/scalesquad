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

After one build, use `npx playwright test --project=mobile-ios` (or `chromium`,
`mobile-android`) for a shorter run. `npm run test:e2e:ui` opens the runner;
`npm run test:e2e:report` opens the last HTML report. Build before UI mode if
application code changed. Reports and disposable-test diagnostics are ignored.

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
jobs are initially advisory (`continue-on-error`), as plan 12 requires; all other
checks block on failure. Branch protection is an owner setting.

The optional manual `configured_users` workflow input runs the account smoke
checks using the `test-accounts` GitHub environment. Set `E2E_LIVE_BASE_URL` as an
environment variable and the account pairs above as environment **secrets**.
Those secrets are available only to that manual test step. It uploads no reports,
traces, screenshots, outbox files or databases. Normal PR jobs need no account
secrets. The workflow must be committed/pushed before GitHub can run it.
