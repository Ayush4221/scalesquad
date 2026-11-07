# Implementation status — 2026-11-06

Latest code review, fixes and validation are recorded in [CODE_REVIEW.md](CODE_REVIEW.md).
The verification figures below record the original 2026-11-05 implementation run.

Steps 01–09 are implemented. All ten review findings have code fixes and
regressions. Steps 10–11 have implementations with email delivery removed by
owner choice; physical-device push verification is still open. Step 12's Playwright and GitHub Actions
parts are implemented; deployment and human playtesting remain open. No commits, branches or worktrees
were created, and the game design document and owner plan files were preserved.

## Structure retained

One root package and lockfile; standard Next.js `src/app`. Application code stays
under `src`, with MVC controllers → services → repositories, shared DTOs and
strict reusable validators. Public assets and build configuration stay at the
Next.js root. Every test and helper lives under the single root `tests` tree.

## Review fixes

| #   | Fix                                                                                                                                                                            | Verification                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | Exact trusted proxy IPs; right-to-left forwarding-chain validation; HTTP, auth and WS limits use the same helper                                                               | Forged/malformed chain, mapped IPv4/IPv6, independent client buckets and real auth HTTP quota tests |
| 2   | OAuth adapter allowlists identity fields; existing unused tokens cleared on boot                                                                                               | Mocked adapter and real Postgres token-null assertions                                              |
| 3   | Fresh session authorization before outgoing WS messages; periodic idle checks; immediate per-session/per-user revocation                                                       | Idle expiry without inbound messages, logout close, live DB sessions/password-change revocation     |
| 4   | Narrow member presence/holder-lease writes; no aggregate revision bump; bounded serialization retries                                                                          | In-memory presence and real DB ping/config contention checks                                        |
| 5   | Bounded due-ID timer with overlap guard; separate inactivity and finished-group sweep                                                                                          | Due selection, active-member protection, 30-minute abandonment and retryable group cleanup tests    |
| 6   | Valid required Compose substitutions; no literal fallback database password                                                                                                    | File inspection; Docker is absent, so compose execution is unverified                               |
| 7   | Regional Nexconn HTTPS/WSS CSP hosts replace the incorrect wildcard                                                                                                            | CSP regression assertions; live chat remains credential-dependent                                   |
| 8   | Removed `cn`; local wrapper uses clsx and tailwind-merge                                                                                                                       | Conditional classes and conflicting Tailwind utility regression                                     |
| 9   | Per-host serialization, active/membership/daily creation caps before chat provisioning; cleanup retains quota for pending groups                                               | Concurrent cap, daily cap, membership cap and failed-cleanup reservation tests                      |
| 10  | Privately owned cumulative state for untraced simulation; immutable public trace steps; engine compiled once per process in development and loaded from built JS in production | Pure/worker equality, frozen inputs, repeated determinism, trace tests and worker hard timeout      |

## Plan 10

Manifest, generated icons, install guidance, static-only worker, offline shell,
waiting update and logout purge are present. Mobile tabs, sticky status/editor,
drawers, metric cards, explicit evidence drafts and keyboard-aware bounded chat
are implemented. Strict owner-bound push subscription routes, a five-device cap,
content-free notification service, event hooks and worker handlers are tested.

The plan-specified `web-push` transport is installed and wired. Matching P-256
VAPID keys/contact are validated at boot; sends are encrypted, bounded and expire
after 60 seconds. With no keys, settings reports notifications unavailable.
VAPID setup and actual delivery still need completion.
See `mobile-ux.md` for the exact device checklist and the limited 360px desktop
browser check; no physical Android/iPhone install or delivery is claimed.

## Plan 11

Owner chose built-in scrypt, pepper off and CAPTCHA off, then explicitly chose
simple signup/login without verification or email delivery. Registration, immediate
login, change-password, logout and logout-all use the same Auth.js database
sessions in development and production. Password hashing, strict DTO validation,
rate limits, generic errors and immediate socket revocation remain enforced.

Mail settings, sender/outbox implementation, email-token service/repository,
verify/reset controllers/routes/pages and unverified-account purge were removed.
Password emails are not required for deployment. Password change requires the
current password; forgotten-password recovery is unavailable for now.

New password accounts retain `emailVerified=null`; no mailbox ownership is
invented. Auth.js keeps default OAuth no-link behavior, and OAuth no longer
removes or rewrites a same-email password account. Historical migrations and
token-table storage remain intact; no stored data was dropped. See `auth.md` and
`project-flow.md` for the request flow and maintained MVC structure.

## Verification

- Unit/UI/HTTP/WS suite: **339 tests passed** across 34 files. All coverage gates
  passed, including 100% simulator gates, 90% auth/push controller/service gates
  and 90% PWA gates. Overall instrumented coverage: 89.66% lines, 84.31% branches.
  PWA coverage: 98.62% lines, 92.1% branches.
- Real Postgres integration coverage now exercises immediate signup/login,
  password change with real scrypt, shared Auth.js sessions, OAuth identity
  preservation, token dropping, game transactions and push ownership/caps.
  **Eight tests passed** in a separate isolated database with all three existing
  migrations applied. The temporary integration database was removed afterward.
- Lint, formatting and typecheck passed. Production build passed for Next.js,
  the custom server and simulator.
- Browser check: real local sign-in/register rendered at 360×800; registration
  had no horizontal overflow, inputs used 16px text and 44px touch targets.
- Playwright cases now cover no-email signup, immediate login/play, password
  change and rejection of removed email endpoints. **58 passed, four optional
  configured-account checks skipped** in one complete 4.2-minute run: 20 desktop
  Chromium, 19 Pixel 7 Chromium and 19 iPhone 13 WebKit. The production-built
  PWA/cache/offline check passed as part of that run.
  The configured-account runner was verified with a disposable account in the
  preceding implementation. No real credentials were needed.
- GitHub Actions validates lint, types, coverage, build, real database tests,
  production dependencies and secrets; separate browser jobs start advisory per
  plan 12. Workflow YAML parsed locally. The workflow awaits an owner push before
  its first actual GitHub run. The reviewable file tree and existing Git history
  passed redacted Gitleaks 8.30.1 scans. Local credentials are ignored and excluded
  from the file-tree scan snapshot.
- Production dependency audit: zero reported vulnerabilities after a scoped
  override of Prisma tooling's existing `deepmerge-ts` dependency to 8.0.0.
  The full developer-tool tree still reports 14 low/moderate advisories; no forced
  Prisma major upgrade was applied. Generation/migrations/build are rechecked.

Nexconn's official docs and installed SDK types were reviewed; the implementation
uses real APIs and reports unavailable when unconfigured. Live Nexconn, actual
Google/GitHub consent, VAPID delivery, physical-device behavior
and deployment are not verified. No messages were sent to other people.

## Development signup fix

The development CSP blocked React's debugging runtime, so controlled signup
fields stayed disabled before hydration. Development HTML now allows the
required evaluation directive; production and built-test pages remain strict.
The exact same-origin/Host Next reload socket is left to Next only in development;
game socket session checks remain unchanged.

Verified on the running local development app: Name, Email and Password each
accepted clicks, focus and typing; the submit button enabled; the development
reload socket connected with no browser errors. Added regression checks for CSP
separation and development-upgrade routing, including wrong Host/Origin,
unknown paths and production rejection. All 339 unit/UI/network tests and
coverage gates passed, as did lint and typecheck.

## Public home — Incident Brief (2026-11-06)

The selected second design is implemented at `/` for guests. It explains the
three-player game, playbook and roles before account creation. Signed-in visitors
still redirect to `/play`. Signup/sign-in brand links return to the public home.

The view uses the existing shared palette, Lucide icons and scoped CSS. It adds
headline reveals, button transitions and real navigation loaders, card feedback,
and a pausable five-scene mission preview. The preview has no game API or private
scenario access. Reduced motion disables effects and uses manual scene controls.
Layouts were checked from 320px to desktop. The skip link has an explicit tab stop
for WebKit; the public home leaves installation guidance inside the app.

The supplied hydration diff contains extension-injected attributes. Clean browser
checks found no hydration errors and confirmed usable signup/sign-in fields.
Disable Urban VPN for localhost and reload; no hydration warning suppression was
added. See `ui-components.md` for the diagnosis.

Verification: all **385 unit/UI/HTTP/WS tests** and coverage gates passed (39 files;
90.04% instrumented lines, 84.06% branches). The final landing/PWA-focused checks
passed all 16 tests after the WebKit skip-link adjustment. Lint, formatting, types,
Next.js production build and server compilation passed.
The focused home/auth/login browser run passed **39 checks** across desktop
Chromium, Pixel 7 Chromium and iPhone 13 WebKit, using isolated test accounts and
database. It covers guest navigation, signed-in routing, input hydration,
keyboard/skip-link focus, reduced motion, loading, retry and password flows.

## Android Flutter foundation — 2026-11-07

Owner requested implementation after plan 14 review. Read repository AGENTS.md,
CLAUDE.md and local Agent Bridge decisions. No CODEX.md or agents.ms was found;
AGENTS.md is the repository's Codex instructions adapter. The manager approved
SDK-only A1 scope, dev-only identifiers and licensed PNG export of existing icons.

Implemented `mobile/`: standard Android Flutter package, thin Navigator boundary,
local introduction controller/models, native guest home and interactive role/mission
walkthrough, reusable theme/panels/buttons, and disabled voice BETA card. Colours
and Android launch background are generated from the existing palette. Approved
logo/fonts and density-specific Lucide artwork include registered licence texts.
No account/game/chat/push backend is simulated or connected in this slice.

Direct Flutter dependencies are SDK-only. Native tests stay package-local under
the owner-approved exception. Root formatting/lint/test/type tooling excludes
Flutter outputs; staged Dart uses bounded formatting plus analysis without invoking
Flutter for web-only commits. Pinned Flutter test and Android compile jobs join
the existing required CI gate. Workflow structure/pins were validated locally;
GitHub-hosted runs have not been observed for these uncommitted changes.

Validation:

- Flutter 3.47.1 / Dart 3.13.1 format and analyzer passed.
- Five controller/widget/golden checks passed, including navigation, role changes,
  disabled voice, 320px/large-text fit and reduced-motion loading behavior.
- Home golden inspected with the actual bundled fonts/assets.
- APK build passed: `mobile/build/app/outputs/flutter-apk/app-dev-debug.apk`.
- APK inspection: `com.example.scalesquad.dev`, min API 26, target/compile API 36;
  debug INTERNET permission only, plus AndroidX's non-exported receiver permission;
  no microphone, camera or notification permission.
- Root lint/typecheck passed. All 429 existing tests passed with two workers after
  an initial Windows worker crash at default concurrency; no failed assertion was
  hidden or removed.
- Shared palette drift and required native CI dependency/pin checks passed.

The Android toolchain initially failed in Java's local-pipe connection. A
manager-approved command-only short `jdk.net.unixdomain.tmpdir` inside ignored
`.cache/udtmp` allowed compilation; it is not a tracked Gradle/system/firewall
change. The build also caught and fixed AGP 9's disabled custom-resource feature
by putting the development label in normal flavor resource XML.

An Android integration smoke test is authored but not run: no Android device or
configured emulator was available. Native auth/contracts, provider chat and live
mixed-client gameplay remain A2 onward. Production identifiers/signing and release
remain disabled. A1 foundation evidence does not mark the full Android plan done.
