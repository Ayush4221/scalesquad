# State lifecycle verification

Date: **2026-11-14**. Scope: the current uncommitted working tree, including the
existing mobile redesign and development-limit fixes. Existing changes were
preserved. No commit, branch or remote publication was made.

The [73-family inventory](IMPLICIT_STATE_MACHINES.md) now records **29 hardened
families** and **44 retained guarded/delegated families**. These were not 73
confirmed bugs, and the inventory does not prove every possible interleaving.

## What changed

- Match requests have a cancellable lifetime, match identity/revision checks and
  evidence request ordering. Late replies and failures cannot overwrite a newer
  match or evidence request. Successful commands remain successful when only the
  follow-up refresh fails. An abandoned command cannot unlock a new command.
- Password change and logout block repeated submission before the next render.
  API caller cancellation differs from timeout, including a stalled response body.
  Shared browser deadlines live in `src/utils/deadline.ts`; timing constants live
  in `src/constants/lifecycle.ts` and display text stays in feature string files.
- Chat observes the installed SDK's documented connection handler. Engine and
  handler ownership prevent stale status updates; send cleanup uses draft identity.
- Notifications distinguish permission, browser subscription and confirmed server
  registration. Failed rollback stays visible and retry reuses existing endpoints.
  Worker readiness is bounded, listeners are released, and optional logout cleanup
  cannot indefinitely block session revocation.
- Chat create/join/leave persist reconciliation intents before remote work. Failed
  compensation survives restart. Readiness/start wait for pending member repair;
  confirmed ambiguous database commits do not masquerade as failed create/leave.
- Run begin/settle transitions are shared across execution, error and recovery.
  Completion requires all stage results. Partial retries validate and reuse saved
  results. Invalid locked phases fail closed. Worker settlement and shutdown each
  have a single owner; shutdown also drains scheduled maintenance.
- Native startup uses idle/animating/ready phases. Skip, completion and reduced
  motion converge on ready. Material press changes coalesce into a pending frame.
  Match tabs/drafts/unread counts, invite feedback and disabled selectors have
  explicit reset/teardown guards.

Game rules, authoritative server checks, scenario inputs, private evidence and
production resource limits retain their existing contracts. Development quota
bypass still applies only to the exact development environment. No dependencies
were added. Native authentication/live gameplay/provider integration remain planned;
voice remains disabled.

## Final local results

| Check                                                | Result                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Lint and formatting                                  | Passed                                                                    |
| TypeScript check                                     | Passed                                                                    |
| Unit tests and existing coverage gates               | **506 passed**, 56 files                                                  |
| Web and server build                                 | Passed                                                                    |
| PostgreSQL integration                               | **11 passed**, 2 files                                                    |
| Full browser matrix, 2 workers, zero retries         | **106 passed**: 36 Chromium, 35 Android profile, 35 iPhone/WebKit profile |
| Flutter format, analysis and widget/golden tests     | **20 passed**, no analyzer issues                                         |
| Actual Android emulator flows                        | **4 passed**, zero retries, dedicated API 35 Pixel 7 AVD                  |
| Native Flutter integration smoke                     | **1 passed** on the same emulator                                         |
| Normal dev APK build/install after integration test  | Passed; emulator settings restored and dedicated emulator stopped         |
| Mobile palette/icons/logo/fonts/licenses drift check | Passed                                                                    |
| Production dependency audit                          | **0 vulnerabilities**                                                     |
| Gitleaks history plus non-ignored text snapshot      | **0 leaks**; 15 commits scanned, uncommitted text included separately     |
| Whitespace check                                     | Passed                                                                    |

Coverage totals: statements **89.69%**, branches **85.17%**, functions **80.72%**,
lines **90.34%**. Per-area thresholds, including simulator 100% and service/PWA
gates, passed without lowering thresholds or excluding new code.

The final full unit/build/browser sequence ran after the last runtime change.
Browser mobile profiles are emulation; the four separate native checks operated
the actual Android APK through fresh accessibility snapshots and input events.

## Database migration

Added `20261114000000_chat_reconciliation`. The orphan-capable journal deliberately
has no Match foreign key, and version checks protect newer intents from stale
completion/defer operations. Tests cover persistence without a match, restart,
failed compensation, retry deferral and stale versions.

The migration passed on isolated `*_test` databases. It was also applied to the
verified local development database after confirming all prior project migrations
were already applied and only this additive migration was pending. Its migration
status is now current. Existing application rows were not rewritten or used for
tests. Other deployments must apply the checked-in migration before this version.

## Evidence and limits

Ignored local logs: `.cache/state-{lint,typecheck,coverage,build,database}.log`,
`.cache/state-browser-flows.log`, `.cache/state-mobile-check.log`,
`.cache/state-native-flows.log`, `.cache/state-native-integration.log`,
`.cache/state-{assets,audit,secrets-history,secrets-working}.log` and
`.cache/state-development-{migration,status}.log`.

Targeted regression files cover late match/evidence replies, command resync,
socket ownership, forced revocation checks, SDK status ownership, notification
rollback/teardown, install prompt reuse, draft preservation, worker settlement,
partial run recovery and durable membership compensation.

The refreshed dependency graph has 166 source files, 806 nodes and 1,427 edges.
All 73 inventory source anchors were checked. This graph is structural evidence,
not an automatically inferred runtime transition proof.

Hosted GitHub Actions was not run: these are local checks of uncommitted code.
Configured-account/provider delivery and real push delivery were not verified.
Browser subscription/permission work and SDK reconnect internals remain platform
owned. Reconciliation retains unknown provider failures instead of inventing
already-absent success codes. Single-process membership ordering is retained;
multi-process distributed locking is outside the current deployment model.
