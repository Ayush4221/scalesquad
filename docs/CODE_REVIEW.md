# Code review — 2026-11-06

Reviewed the app against `CLAUDE.md`, the architecture, the authoritative game
design and the current owner-approved auth flow. Scope includes auth and sessions,
HTTP/WS boundaries, repositories and migrations, match lifecycle and locks,
simulator determinism and recovery, Nexconn, browser forms and navigation, PWA,
shared validation, palette use, test tooling and CI.

## Findings fixed

| #   | Severity | Finding and fix                                                                                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                              |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | High     | WS frames queued before their rate check, so slow authorization allowed an unlimited promise/data queue. Admission now happens immediately, pending work is bounded, flooding closes the connection, and queued actions stop.                                                                                                                                                           | Gateway test blocks authorization, sends 200 frames, checks closure and verifies no queued action runs.               |
| 2   | High     | Chat joins/leaves and match start could race. A timed-out join could also leave upstream access after local rollback. A per-match lobby queue now covers join, leave and start. Failed joins revoke chat access before releasing membership; failed revocation keeps an unready reservation that a join retry can repair. Failed leave persistence attempts to restore chat membership. | Delayed join/start and leave/start tests; partial upstream success, failed cleanup/retry and failed leave-save tests. |
| 3   | Medium   | Rotating fresh limiter keys could grow the map indefinitely and trigger repeated full scans. Buckets now have a hard cap, reject new keys when full, preserve active quotas and limit capacity-triggered cleanup to once a minute.                                                                                                                                                      | Fresh-key flood, unchanged existing quotas, bounded scans and expiry recovery tests.                                  |
| 4   | Medium   | Old chat cleanup could disconnect a replacement because Nexconn uses one page engine. Lifecycle work now runs in order with an explicit owner; only that owner can disconnect. Failed connects remove their handlers. The panel resets messages and disables its composer when chat becomes unavailable.                                                                                | SDK-mocked delayed-connect, replacement, repeated cleanup, failed-connect and panel availability tests.               |
| 5   | Medium   | A crash after saving results but before finalizing phase left completed runs stuck in repair; retry returned results without fixing phase. Recovery now finalizes stored completions, unfinished runs return to repair, and retry repairs older stranded records. A failed final-state save also preserves completed results.                                                           | Baseline and repair restart tests; incomplete crash, older-record retry and final-save failure tests.                 |
| 6   | Medium   | A Run 3 request during baseline execution was treated as a duplicate and returned baseline results. In-flight work now records its requested run and rejects a different action.                                                                                                                                                                                                        | Pending baseline + Run 3 regression.                                                                                  |
| 7   | Medium   | A failed Leave request still redirected the player. Successful leave also fetched a view that membership removal correctly forbids. Navigation now requires success and skips that redundant fetch.                                                                                                                                                                                     | Browser test rejects Leave, checks roster/location, then retries successfully.                                        |
| 8   | Medium   | Client state could survive navigation between matches, retaining the prior revision, private brief or chat. Match pages now key the client shell by user and match, forcing a fresh state and cleanup.                                                                                                                                                                                  | Route composition review; chat reset regression; full browser match/reconnect coverage.                               |
| 9   | Low      | Match graph reads fetched whole user rows, including password hashes. They now select only the display name needed by the mapper.                                                                                                                                                                                                                                                       | Real Postgres match lifecycle tests with the narrowed query.                                                          |
| 10  | Medium   | Blocked Cache Storage made successful logout look unsuccessful and kept the private page visible. Logout now attempts static-cache purge and still leaves the page after session revocation if storage is unavailable.                                                                                                                                                                  | Browser test blocks storage and checks sign-in navigation plus session deletion.                                      |
| 11  | Low      | The normal lint command rejected Windows checkout line endings. Prettier now preserves the current file line endings without rewriting the whole repository.                                                                                                                                                                                                                            | Normal `npm run lint` passes without command-line overrides.                                                          |

The auth review also found a **High** severity audit amplification issue: every
rate-limited auth request still wrote a `THROTTLED` database row. This is fixed by
sampling once per source network prefix per minute, with a shared burst of ten
and one event per second refill. Normal auth actions keep their audit records.
Regression tests exercise 100 repeated sources, 100 rotating sources, refill,
and a real HTTP burst with 27 rejected requests producing one throttle audit row.
This is finding **12**.

**13 — Moderate, tooling dependency:** the installed minimatch version had a
[pattern amplification advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The root override and lockfile now pin the existing transitive dependency to
patched 11.0.1. Node compatibility, lint, types, tests, builds and shadcn's MCP
startup/tool listing/project-registry read were checked. All moderate audit
entries from this dependency chain are cleared.

**14 — Medium, sign-in accessibility:** error focus used an animation-frame
callback that could run before the error rendered or pause in a background page.
Focus now runs after the message commits. A regression pauses animation frames
and verifies error focus; browser checks retain the keyboard/focus assertions.
Touch profiles use taps for retries and wait for the actual retry response.

All identified findings above are fixed. The earlier ten findings listed in
`IMPLEMENTATION.md` were rechecked against their code and regression coverage.
There are **14 fixed findings**. Application structure, direct stack dependencies,
database schema and game rules are unchanged. The dependency change is the scoped
transitive tooling override above. All added tests remain under root `tests/`.

## Validation

- Unit/UI/HTTP/WS: **380 passed in 38 files**; all coverage gates passed.
  Instrumented coverage: 90.03% lines, 84.05% branches. Repository behavior is
  additionally exercised by separate real-database tests; this unit percentage
  does not imply repository unit coverage.
- Real Postgres: **8 passed** with all three migrations in a new disposable
  `*_test` database, removed afterward. Rechecked after the final auth/recovery fixes.
- Browser: **73 passed** in the final complete run across desktop Chromium,
  Pixel 7 Chromium and iPhone 13 WebKit, including failed-leave retry,
  blocked-storage logout, sign-in focus and touch-based retry cases.
- Lint and typecheck passed. Next production build and custom server/simulator
  compilation passed.
- Production dependency audit: **zero reported vulnerabilities**.
- Full dependency audit: **three low-severity development-tool entries remain**
  from one [unpatched deepmerge issue](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
  and its `@shadcn/registry`/`shadcn` dependents. The published advisory lists no
  patched release. The suggested forced CLI downgrade was not applied.
- Redacted secret scan: no leaks in the reviewable file snapshot or four existing
  Git commits. Private local env and credential files were excluded.
- GitHub Actions workflow parses and has lint/type/coverage/build, database,
  dependency, secret and browser jobs. Its remote execution still needs an owner push.
- The updated single lockfile passes `npm ci --ignore-scripts --dry-run`.
  shadcn's MCP starts, lists seven tools and reads the project registries.

Mobile retry coverage uses actual taps on touch profiles and checks both the
failed response and the successful retry response. The iPhone run-retry case also
passed five consecutive focused runs.

## Limits of verification

Live Nexconn delivery, actual Google/GitHub consent, physical-device push/install
behavior and VPS deployment were not exercised. Chat lifecycle/race tests use
controlled providers; they cannot prove a remote provider's delivery behavior.
The browser suite uses disposable accounts and blocks third-party traffic.

Lobby ordering and rate limits retain the documented single-instance assumption.
Provider compensation is best effort during an outage: a retained membership
reservation can be repaired by retry, and abandoned matches still get bounded
cleanup. Process termination between independent remote and database operations
does not have a durable outbox guarantee.

The current Compose file provisions development Postgres only. Production
Docker/Caddy deployment remains the separate open work already recorded in the
implementation status; the app has not been declared deployed.
