# Step 14 — Android-first Flutter application

Status: requested 2026-11-07; implementation started with the manager-approved
A1 SDK-only Android foundation. See `mobile/README.md` for implemented scope and
validation. Native sessions, chat, Firebase and the full game client remain planned.
The owner explicitly requests Flutter in the same repository, Android first.
Review update: the owner approved package-local Flutter tests in this chat on
2026-11-07. See [the native-client decision record](../decisions/0001-flutter-android.md).

## 1. Outcome and boundaries

Build a real Flutter Android client for the existing ScaleSquad game. It shares
the current Node/Prisma/Postgres backend, users, scenarios, authorization and
deterministic simulator with the Next.js app. Web and Android users can occupy
the same three-person squad. Do not use a WebView wrapper, create another game
backend, move the simulator into Dart, or introduce Firebase Auth/Firestore.

First release covers guest introduction, email/password signup/login, dashboard,
scenario selection, create/join/resume, lobby, private evidence, repair/locks,
three runs, comparison/results, Nexconn text chat and account settings. Keep the
existing owner-approved password policy and simple unverified signup; no SMTP,
verification mail or email password recovery is reintroduced. OAuth is a later
opt-in extension, not a dependency of Android v1.

**Voice remains disabled with BETA / Coming soon.** The owner cancelled voice
implementation; step 13 is not a prerequisite for this work. Do not install Call
SDKs or request microphone/camera permission. Android is the first shipped
platform; keep Dart/platform boundaries suitable for iOS later without promising
that an Android build establishes iOS support.

## 2. Decisions to settle before creating the app

Recommended defaults below are proposals, not already approved dependencies:

| Decision        | Recommendation / gate                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location        | One Flutter app at root `mobile/`; existing Next.js `src/app` and root npm package stay in place                                                   |
| Architecture    | Feature-based MVC in Flutter, with thin widgets, controllers and repositories; server MVC remains unchanged                                        |
| State           | SDK `ChangeNotifier` / `Listenable` controllers and explicit constructor injection initially; avoid multiple state libraries                       |
| Navigation      | Evaluate `go_router` for guarded navigation, nested match tabs and verified links                                                                  |
| HTTP / sockets  | Evaluate `http` and `web_socket_channel`; one shared transport per responsibility                                                                  |
| Secret storage  | Evaluate `flutter_secure_storage`; verify Android Keystore, backup/restore behavior and plugin compatibility                                       |
| Chat            | Verify/pin Nexconn's official Flutter Chat plugin; no JS bridge or calling package                                                                 |
| Notifications   | FCM after the playable core; `firebase_core` and `firebase_messaging`, not Firebase Auth                                                           |
| Icons           | Lucide only; approve a maintained Flutter package or generate bundled assets from the existing Lucide set                                          |
| Platform        | Pin one Flutter stable/Dart version, compatible JDK/Gradle/Android SDK versions and all app dependencies                                           |
| Android support | Provisional minimum Android 8/API 26; raise if selected plugins require it. Confirm target SDK against current Play policy at release              |
| Environment     | Development, staging and production flavors with distinct application IDs/configuration and separate backend databases                             |
| Distribution    | Debug APK for development, internal testing first, signed AAB for Play release                                                                     |
| Crash reporting | Select one tool in A0 (Crashlytics or Sentry are candidates), approve its SDK and verify redaction before release; no analytics enabled implicitly |

Confirm Android application ID, app/display name, domain for App Links, staging
API URL, Play Console ownership, Firebase ownership if enabling push, and approved
package list. Never invent production identifiers, keys or signing credentials.

CLAUDE.md/architecture now record the explicitly requested native exception:
Flutter belongs in `mobile/lib`, not Next's `src/`.
Flutter requires **one `pubspec.yaml` and `pubspec.lock`** in addition to the
existing single npm manifest/lockfile. No per-feature packages, npm workspaces,
Melo setup or extra `src` directory inside each Flutter feature are needed.
These changes are scoped to the native client; existing server rules still apply.

## 3. Same-repository layout

```text
scalesquad/
  src/                              existing web + server + shared TS contracts
  mobile/
    pubspec.yaml                    single Flutter manifest
    pubspec.lock                    pinned application dependency resolution
    analysis_options.yaml
    lib/
      main.dart
      app/                          bootstrap, router, configuration, composition
      core/
        network/                    HTTP, socket and error adapters
        session/                    session lifecycle and secure token store
        theme/                      generated palette, type, spacing, motion
        widgets/                    reusable fields, buttons, sheets, states
        constants/                  client-only constants; no copied game rules
        utils/                      small shared helpers, no catch-all helpers file
      features/
        introduction/
        auth/
        dashboard/
        lobby/
        briefing/
        repair/
        results/
        chat/
        settings/
          models/                   only where the feature needs local models
          controllers/
          repositories/
          views/
      contracts/                    generated DTOs/enums/API and event parsing
    android/                        standard Flutter Android host and flavors
    assets/                         approved logo/fonts; no embedded secrets
    test/                           authored unit/widget/golden tests and fixtures
    integration_test/               authored Android integration tests
  tests/
    contracts/                      shared TS/Dart JSON contract fixtures
    ...                             existing shared/server/web/Playwright tests
  scripts/                          palette/contract generation and checks
  docs/
```

The feature subfolders shown under settings are a pattern, not mandatory empty
folders for every feature. Views render; controllers own view state/actions;
repositories coordinate canonical client data; services/adapters perform I/O.
Widgets never issue raw HTTP or Prisma queries. Repositories are injected and
mockable. Flutter can use Material primitives with the ScaleSquad theme; Tailwind
and React components do not run in Flutter.

**Recorded owner exception:** authored Flutter tests live in `mobile/test` and
`mobile/integration_test`, tracked in Git. Goldens and native fixtures stay beside
those tests, with normal Flutter IDE discovery and coverage paths. There is no
test-copy/staging layer or symlink. Existing web/server tests remain under root
`tests/`; only fixtures consumed by both TS and Dart live in `tests/contracts`.

### Root-tool boundaries — implement in A1

- Add `mobile/` to `.prettierignore` and ESLint global ignores. Add explicit
  `mobile/**` exclusions to Vitest discovery and coverage; keep current root
  TS/Web test includes intact. Exclude native files from the JS lint-staged task,
  including Android JSON/YAML/Gradle-related files; do not send them to Prettier.
- Add scoped ignores for `mobile/.dart_tool/`, `mobile/build/`, Flutter plugin
  metadata, Gradle caches, local SDK properties and generated signing files.
  Do not ignore `pubspec.lock`, Gradle wrapper sources, tests or golden baselines.
- Extend the existing batched pre-commit runner: staged Dart files run through
  `dart format` in bounded batches, followed by one package-wide `flutter analyze`
  in `mobile/`. Web-only commits must not require an installed Flutter SDK. Dart
  commits fail clearly when it is missing. Preserve the 30-file/Windows argument
  limits and test the Windows SDK launcher/path-with-spaces behavior.
- CI also runs `dart format --output=none --set-exit-if-changed .` and
  `flutter analyze` from `mobile/`; hooks are not the only enforcement.

## 4. Screen and interaction plan

| Screen        | Required content and behavior                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Bootstrap     | Restore/check session without flashing private content; expired session returns to guest state                                       |
| Guest home    | Explain the game, three roles and squad loop before asking for login; clear Create account / Sign in actions                         |
| Signup        | Name, email, password requirements, visibility toggle, focused field errors, safe server errors, locked/loading submit               |
| Login         | Email/password, keyboard submit, clear rate-limit/outage messages, no duplicate request, no removed reset link                       |
| Dashboard     | Scenario cards from server metadata, Create, eight-character Join, active match resume, settings                                     |
| Lobby         | Current three-seat design, invite-code tiles/masking/copy/native share, joined/ready counts, host start and member leave             |
| Briefing      | Role and owner-only cards; explicit acknowledgment; Share fills a draft and never sends automatically                                |
| Match shell   | Persistent phase/deadline/editor status; Brief, Squad, Repair, Results and Chat destinations                                         |
| Repair        | Scenario-provided choices with help, read-only peer view, handoff/reclaim, cost/budget feedback and version-conflict recovery        |
| Runs          | Distinct pending states, authoritative run progress/results, duplicate-start prevention and safe retry/resync                        |
| Results       | Run 2/3 comparison, verdict, rounded percentages, better/worse direction, preset-to-repair changes and next-match navigation         |
| Chat          | Three known members, role reveal after briefing, bounded history, mentions/quotes, unsent draft retention and honest reconnect state |
| Settings      | Profile/session status, change password, logout/all sessions, notification preferences, privacy and account deletion                 |
| Shared states | Loading, empty, unavailable, offline, expired session, non-member and incompatible-client messages                                   |

Android Back dismisses keyboard/sheet before navigating. Leaving a live match
requires deliberate action; no accidental host departure or local phase changes.
Preserve invite intent through authentication, but joining always requires server
validation. No fake latency, extra members, scores or ranking claims.

### Design system

Use the approved dark/cobalt/lime palette and logo. Keep `src/styles/palette.ts`
as the color source and generate the Flutter color definitions with a small
deterministic exporter; no manually maintained second hex palette. Sync the
approved local fonts/assets and licenses. Semantic color names, spacing/type
scales, radii and component states live under `mobile/lib/core/theme`.

Create reusable primary/secondary/destructive buttons, labeled input/password
fields, player cards, chips, metric cards, bottom sheets, alerts and skeletons.
Use restrained 120–200 ms motion, no animation blocking input, and respect reduced
animation settings. Target 48 logical-pixel touch areas, TalkBack semantics,
focus order, large text, contrast, IME insets and edge-to-edge safe areas. Verify
small phones, landscape and tablets; the initial product remains phone-first.

Approve low-fidelity navigation and guest/auth/dashboard/lobby/match/chat mockups
before polishing every screen. Flutter implementation reuses design intent,
not screenshots pasted into a native shell.

## 5. Backend and contract work — before connecting screens

Current HTTP mutations enforce the web Origin and cookie session; `/ws` also
requires that Origin and the session cookie. `/api/game/me` returns identity,
not a resumable-match list. Scenario selection is currently assembled for web.
These are actual integration gaps, not reasons to loosen existing web security.

### Native sessions

Recommended native transport: scoped opaque Bearer access tokens plus rotating
refresh tokens, backed by the same account database and a native-session record.
Do not scrape Auth.js cookies, copy a browser session into Dart or spoof an Origin
as a substitute for native authentication. Confirm this design in the contract
milestone before implementation.

- Add versioned mobile register/login/refresh/logout endpoints, proposed under
  `/api/mobile/v1/auth/`. Password verification, signup rules, dummy-hash timing,
  account/IP throttling and password changes reuse the existing service logic.
  Refactor shared verification/session issuance through typed ports as needed;
  do not duplicate the auth policy or call browser HTTP handlers internally.
- Adapt native auth admission for carrier/shared-network IPs. Current web limits
  are 5 registrations/hour and 10 logins/15 minutes per IP; do not copy those hard
  caps to native endpoints. Use failed-account backoff, server-issued device/session
  risk markers and a higher, measured aggregate-IP abuse budget/concurrency cap.
  A self-chosen/resettable device ID is only a signal, never identity or an unlimited
  quota bypass. Correct credentials must not be locked out by an attacker's failed
  account attempts. Keep signup/email abuse and global password-hash resource
  budgets bounded; do not silently weaken existing browser protections.
  Required tests: at least 30 distinct accounts signing in behind one IP,
  legitimate signup bursts, one abusive account/device, device-ID rotation,
  IPv6 prefix rotation, and overload without starving unrelated users.
- Proposed access lifetime: 10 minutes. Refresh absolute lifetime: 14 days.
  Generate at least 256 bits of random credential entropy and store only token
  hashes server-side. Native sessions carry user, device/session ID, expiry,
  rotation family and revocation state. Store refresh credentials using verified
  secure storage; prefer keeping access credentials in memory.
- Rotate refresh tokens atomically with single-flight client refresh. Detect reuse,
  revoke the family and require login; explicitly test lost responses, concurrent
  requests, app termination during rotation and database errors. No unlimited
  refresh grace or automatic retries of ambiguous refresh requests.
- Extend logout-all/password-change/account-deletion revocation to web and native
  sessions. Preserve current-session exceptions intentionally, with separate
  typed credential identities; never compare native hashes with raw web cookies.
- Persist only minimal session metadata. Passwords, refresh credentials and
  Nexconn tokens never appear in logs, crash reports, URLs, screenshots or ordinary
  preferences/backups. Secure-storage restore failure requires login.

Existing game services and `/api/game` routes remain the shared game API. Add a
transport-level principal resolver for validated native Bearer credentials;
keep cookie-authenticated web Origin checks intact. Reject ambiguous credentials.
`X-Mobile`, User-Agent and a claimed platform header are not authentication.
Return the same safe errors, strict DTOs and no-store responses for both clients.

### Native WebSocket and recovery

Use an explicit authenticated native upgrade path, proposed `/ws/mobile`, with
an Authorization header supported by the selected Dart socket transport. Never
put credentials in the query string or subprotocol. Keep browser `/ws` behavior
unchanged; a missing Origin alone never grants native access.

Reuse `Rooms`, authorized sends, membership checks and the existing event schema.
Represent web/native credentials explicitly in peer authorization and revocation.
Token expiry, logout and membership changes close/refuse affected sockets; a
temporary database failure must follow bounded last-confirmed-expiry behavior.

Subscribe after authentication, send foreground state through the existing event,
respect ping/pong and protocol limits, deduplicate by event ID and reject stale
revisions. Refresh credentials and reconnect with bounded backoff/jitter, then
fetch a full current snapshot and owner-only evidence. Never replay queued
ready/config/run commands automatically after reconnect.

On backgrounding, stop unnecessary game traffic; do not use a permanent foreground
service to keep the game alive. On resume/process restart, revalidate session,
membership, deadline, role and edit lease. Show stale data read-only until sync.
Make `serverTimeMs` a required field in the versioned native handshake/snapshot
contract, alongside the authoritative deadline. Derive the remaining duration
from a server-time sample adjusted for measured round-trip delay, then advance
using Dart's monotonic `Stopwatch`; never subtract the phone's wall clock. Request
a fresh sample after resume/reconnect and restart the monotonic baseline. Until
fresh state arrives, show syncing/read-only; never transition the match locally.
Test a phone clock 15 minutes fast/slow, a clock change during play, long suspension,
timer already expired, delayed samples and process death. Roll out the field
backward-compatibly for existing web/event consumers; do not break strict v1 parsing.

### Additional contracts

- Safe scenario-catalog endpoint: public scenario metadata/choices only, never
  private evidence or reference repairs; choose/record access policy explicitly.
- Bounded, paginated own-active-match listing for resume; no arbitrary user lookup.
- Limit A2 idempotency to **create-match and start-run** for ambiguous outcomes. Persist
  user/action/key reservations and safe results; define request-hash conflicts
  and expiry. Do not build a generic retry/idempotency framework for every action;
  other mutations need explicit resync/user retry until individually designed.
- In A0, implement a tiny generator proof with Zod 4's built-in `z.toJSONSchema()`:
  export stable JSON Schema Draft 2020-12 from the registered boundary schemas,
  select/pin a Dart generator supporting that draft and generate DTOs/parsers.
  A2 expands this proved path across the API/event contracts and route metadata.
  Export request/input and response/output forms explicitly. Validate enums,
  nullable/optional/default values, strict fields, numeric timestamps and unions.
  Existing email/password schemas use transforms/refinements; normalization and
  custom business checks do not automatically become JSON Schema. Keep server
  validation authoritative and supply explicit wire-shape schemas/behavior fixtures
  for these cases. Fail export on unsupported constructs instead of using an
  unrestricted `any` fallback or claiming all rules were generated.
- Check in exported schemas and generated Dart sources. CI regenerates both into
  a temporary directory and byte-compares them with the tracked outputs, including
  deletions; any difference fails drift checking. Generated files are never edited
  manually. Never import TS/Zod directly into Dart or duplicate undocumented rules.
- Keep golden request/response/event fixtures under root tests. CI detects drift
  between TS validation, exported contracts and Dart parsing. Specify API/event
  version support and user-friendly upgrade behavior; bound unknown/invalid data.

Every new endpoint and client event requires unauthenticated, non-member,
wrong-role and wrong-phase coverage. For globally authenticated operations where
role/phase is irrelevant, document that and test the permitted roles plus invalid
targets rather than inventing a host restriction. All server changes retain MVC,
Prisma-only repositories, strict schemas, rate limits and the one-process scaling
constraint. No new service needs its own package.json.

## 6. Nexconn text chat

First run a narrow Flutter/Android SDK proof using a pinned plugin version from
the official package linked by Nexconn. Verify Android SDK/Gradle/JDK compatibility,
Singapore initialization, current Dart API signatures, license and release build
with shrinking enabled. The published import guide names
`ai_nexconn_chat_plugin`; inspect current package metadata/types rather than copying
version-sensitive web or older Flutter examples.

Before pinning, verify that pub.dev shows a Nexconn-controlled verified publisher
and that the package/version is linked by Nexconn's current docs. Record publisher
domain, source provenance, version/archive checksum, license/redistribution terms,
transitive Dart packages, native Maven/AAR libraries and versions in
`docs/mobile-sdk-notes.md`. Inspect the merged Android manifest, permissions,
services/providers/receivers, native storage and telemetry. A familiar package
name or a verified-domain badge alone is not a code-security audit. If publisher
ownership cannot be verified, get written provider confirmation and an explicit
dependency exception before installing; do not describe it as verified already.

Obtain a user token through the existing authenticated membership-checked token
endpoint. App Secret stays on the server. Use the same provider user-ID mapping
and match group as web. Wrap SDK methods/events in one `ChatService` adapter and
keep one SDK owner across match tabs/phases. Widget rebuilds do not reconnect it.

Proof gate: web plus Android users exchange text in the same match, history is
bounded, failed send preserves the draft, background/resume recovers, outsider
token requests fail, and logout clears the SDK session/history. Verify same-account
web/Android multi-device rules to prevent competing automatic reconnect loops.
Only the owner chooses to copy private evidence into a draft; chat never fetches
other members' private cards. Avoid unbounded offline message storage; inspect
and configure SDK local persistence, logout deletion and backup exclusions.

If the native plugin fails this gate, record the issue and stop the chat milestone;
do not quietly ship a WebView bridge or a different chat provider.

## 7. Android notifications and links

FCM follows the playable core and can ship in a later build if project/service
setup is unavailable. Basic signup and game play must work without notifications.
Native Android FCM uses device registration tokens; **VAPID is not required for
native Android**. Existing browser Web Push remains separate and unchanged.

- Add authenticated device registration/removal routes with strict token bounds,
  owner/session binding, device caps and notification preferences. Do not reuse
  the browser endpoint/p256dh subscription schema for native FCM tokens.
- Add an FCM transport to the existing content-free notification orchestration;
  send only an allowlisted kind and opaque match reference. No private clue,
  message body, credential, email or join code in notification payloads.
- Use server-side Firebase credentials outside the repo. Firebase client config
  is not an admin credential; separate flavors and prevent accidental production
  targeting. Verify SDK-added permissions and disable optional analytics unless
  separately chosen.
- Request Android notification permission in context, handle denial without
  blocking play, register token refresh and remove invalid/revoked registrations.
  Use one notification owner for game events; avoid duplicate SDK and app alerts.
- Background push is a hint, not guaranteed delivery or authoritative game state.
  Force-stop, Doze, non-Google-service devices and disabled notifications have
  explicit fallback behavior. Re-authenticate/refetch on tap; deduplicate stale
  and foreground events. Never navigate directly into private evidence from push.
- Add HTTPS Android App Links and web fallback for squad invites. Validate the
  eight-character code and authenticate before joining. Publish matching
  `assetlinks.json` using the correct debug/internal/Play signing fingerprints.
  Do not use custom-scheme links as trusted authentication callbacks.

Invite links intentionally contain an expiring join code: forwarding a link outside
the group shares that invitation. Explain this near Share. Current server guards
allow joining only in LOBBY and before code expiry; native and web links must use
those same checks. Do not treat the code as an account credential or include full
invite URLs in crash reports, analytics, access-log paths or notification payloads.

## 8. Testing and CI

Use synthetic accounts and an isolated test database. Do not hardcode test-only
bypasses into production. Reuse common root test support where useful, extracting
browser-independent seeding from Playwright fixtures rather than importing browser
fixtures into Flutter. Existing ignored account credentials are for optional live
checks only; host-side loaders may supply them without compiling secrets into an
APK or uploading them in reports.

| Layer               | Coverage                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dart unit           | DTO/event parsing, policy display, errors, refresh/reuse, command deduplication, revisions, reconnect and secure-store failures                         |
| Widget              | Guest/auth forms, loading/duplicate guards, all three lobby seats, host controls, role visibility, repairs, results diff, chat drafts and accessibility |
| Golden              | Shared components plus guest/dashboard/lobby/match/chat at pinned font/render settings, multiple sizes and large text                                   |
| Server/DB           | Native auth/refresh/revocation, credential ambiguity, socket authorization, contracts, idempotency, active-match privacy and FCM ownership              |
| Android integration | Signup/login, mixed web/native three-player match, private evidence, handoff, three runs, results, chat, logout and process-death recovery              |
| Real devices        | Small phone, Android 13+ permissions, current supported OS, keyboard/back, interruptions, flaky network, push and verified links                        |

Flutter `integration_test` cannot drive all native permission UI. Use emulator
permission setup/host automation where appropriate and explicit real-device checks;
do not claim widget tests prove Android prompts, Nexconn delivery or FCM behavior.

Extend the existing GitHub Actions workflow with pinned Flutter setup/toolchain.
Format/analyze, contract drift, unit/widget/golden tests and debug Android compile
are required and join the existing `CI required` gate; failure/skip fails that gate.
Keep current web/server/Playwright jobs required; they are no longer advisory.
The new Android-emulator integration job is initially advisory, reports failures
and uploads sanitized diagnostics, and is excluded from the required aggregate.
This is the owner's reviewed native-only exception, not a blanket CI relaxation.
Pin emulator image/toolchain, bound timeouts and distinguish infrastructure
failures from application failures. After 20 consecutive clean representative
runs and the real-device playtest, review stability, remove the advisory setting
and add that job to the required gate. Do not hide application failures with
unlimited retries or permanently leave the promotion decision untracked.
Do not path-skip a required job without a gate design that preserves enforcement.
Add Dependabot pub updates for `mobile/` targeting `development`, after verifying
ecosystem support/configuration. No auto-merge bypass.

PR builds use disposable data and debug/test signing, never release secrets on
untrusted branches. Publish sanitized test reports and internal APKs as appropriate.
Signed production AAB jobs run only from protected reviewed refs/environments with
approval, protected signing material and explicit release control.

## 9. Release, privacy and operations

### Local Android networking

The Node server binds `127.0.0.1` and rejects a Host different from `APP_ORIGIN`.
Keep both protections. Standard local setup for emulator and USB-connected phone:

```sh
adb devices
adb -s <device-id> reverse tcp:3000 tcp:3000
adb -s <device-id> reverse --list
```

Use `APP_ORIGIN=http://localhost:3000` and native API `http://localhost:3000` /
socket `ws://localhost:3000/ws/mobile`. The reversed connection reaches the
host's loopback server while retaining the exact expected Host. If local origin
uses `127.0.0.1` instead, configure the app with that exact origin too. Repeat
port reversal after device/emulator reconnect and use the configured port, not
necessarily 3000, in CI. Verify the health endpoint, login and WebSocket handshake.
Do not use `10.0.2.2`, a LAN IP, wildcard Host acceptance, `0.0.0.0` binding or
forged Host overrides as the default workaround. A phone without adb uses the
proper HTTPS staging deployment; Wi-Fi alone does not expose the loopback server.
Allow cleartext only for loopback in the debug Android network config. Release
uses HTTPS/WSS, validates certificates and cannot disable TLS checks. Do not ship
local database URLs, staging credentials or Firebase admin keys.

### Crash/error reporting

Choose one reporting tool and approve/pin its SDK in A0. Capture Flutter fatal
errors, unhandled async failures and native crashes in release builds; map them
to build/flavor/version with private symbol uploads. Disable production reporting
for disposable tests and developer builds. Allowlist fields and scrub before
transmission: no tokens, headers, URLs with invite codes, emails, chat, evidence,
HTTP bodies, SDK raw errors, screenshots or automatic sensitive breadcrumbs.
Use redacted error categories and minimal pseudonymous identifiers only if needed;
test the payload filter with seeded secret/evidence canaries and offline queues.
Set retention/access permissions and include the tool, data flow and collection
choice in the privacy policy/Play declarations. FCM does not require turning on
analytics/crash collection implicitly. Gate public release on an intentional
staging crash reaching the dashboard with no canary data.

Inspect the merged Android manifest for SDK-added microphone/camera/storage
permissions and remove unnecessary ones. No voice/camera feature means no capture
permission or native service in v1. Exclude credentials and private SDK data from
Android backup; purge user state, drafts and notifications on logout/account switch.
Choose and test screenshot/recents protection for private evidence, with an
explicit product decision and accessible behavior.

Schedule [14a — account deletion backend](14a-account-deletion.md) alongside A2,
before Settings and public release. This is a separate small work package covering
recent authentication, hosted/participating matches, Nexconn membership, web/native
sessions, push devices, audit retention and durable retry. A7 verifies its completed
behavior and privacy disclosures rather than first introducing the backend.
Provide the in-app and public web request paths plus privacy/support and data-safety
information before Play release. No SMTP is needed.

Reserve the application ID, configure Play App Signing, keep upload keys outside
Git, assign versionName/versionCode and publish an internal test first. Recheck
current target SDK/developer verification/testing rules for the actual Play account.
Roll out gradually with rollback/kill-switch procedures. Server API changes must
remain backward-compatible for installed clients that cannot update immediately.
Old supported clients should get a clear update path, not broken parsing or login.

## 10. Milestones and exit gates

Estimates assume one developer and reuse of the current backend/design. Allow
roughly **5–8 developer weeks** for a polished Android release with native auth,
chat and test/release work; provider/account reviews and store waits are additional.
Notifications may be split into a later release. Phase ranges total 24–35 working
days including A2D; it is not counted again in A7. Refine after the SDK/auth proofs.

| Phase                        | Work / dependency                                                                                                                                                         | Estimate | Exit gate                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| A0 — Decisions and proofs    | Toolchain/packages, auth design, publisher/SDK checks, Zod-to-Dart generator proof and crash-reporting choice                                                             | 2–3 days | Recorded decisions and reproducible contract/plugin proofs; redaction design agreed                          |
| A1 — Shell and design system | Flutter Android/flavors, package-local test discovery, root-tool isolation/hooks, palette export, guest home and components                                               | 2–3 days | Debug build; token drift check; Flutter IDE/tests/goldens work on Windows/Linux; approved screens            |
| A2 — Native backend          | Shared credential policy, native sessions, CGNAT-safe admission, HTTP/WS adapters, required server time, schema/Dart drift checks, catalog/resume, create/run idempotency | 4–5 days | Authz/DB/contract tests pass; shared-IP cohort and clock-skew recovery pass; web security unchanged          |
| A2D — Account deletion       | Separate 14a backend/web request path, active-game/provider cleanup, devices and retention                                                                                | 1–2 days | Reauthentication, revocation, teammate effects and durable cleanup proven before Settings                    |
| A3 — Auth and dashboard      | Flutter secure session lifecycle, forms, scenario/create/join/resume                                                                                                      | 2–3 days | Real staging login/relaunch/expiry; no duplicate create; usable field errors                                 |
| A4 — Lobby and game loop     | Three seats, readiness, briefing, repair/locks, all runs and comparison                                                                                                   | 4–6 days | One web user + two Android users complete the same server-authoritative match                                |
| A5 — Chat and recovery       | Official native SDK adapter, private draft flow, lifecycle/network/process recovery                                                                                       | 3–4 days | Mixed-client text delivery and logout isolation demonstrated; no evidence leak                               |
| A6 — Notifications and links | Optional FCM, permission UX, device ownership, App Links                                                                                                                  | 2–3 days | Real device receives a content-free alert and safely opens the right current match                           |
| A7 — Hardening and release   | Deletion/privacy verification, crash payload checks, accessibility/performance, required CI and internal AAB                                                              | 4–6 days | Required checks green; advisory emulator results visible; real-device playtest; release checklist signed off |

Proof failures stop the affected milestone with documented evidence and a revised
plan. They do not become permanent disabled substitutes for required Android v1
features. Voice alone is intentionally disabled by the owner's current decision.

## Unit tests required

At each milestone add tests for actual behavior and failure modes, not mirrored
implementation details. Auth/refresh, ownership, lock/version handling, reconnect,
private drafts and logout cleanup are mandatory. Keep Flutter source tests under
`mobile/test` and `mobile/integration_test` under the recorded owner exception;
shared contract fixtures and current server tests stay in root `tests/`. Contract examples must validate on both TS and Dart sides.

## Security checks

- [ ] Web Origin/cookie protection preserved; native bearer auth is independently validated.
- [ ] Every new endpoint/event has the required authorization matrix and strict schemas.
- [ ] Refresh rotation, replay handling, expiry and web/native logout-all are proven.
- [ ] No secrets in app assets/config, ordinary storage, logs, URLs or CI artifacts.
- [ ] No private evidence in squad snapshots, chat auto-send, disk cache or pushes.
- [ ] HTTPS/WSS, release manifest and secure-store/backup behavior verified.
- [ ] FCM ownership and native SDK cleanup are checked; microphone/camera absent.
- [ ] Account deletion, active-match effects and retained-data policy documented/tested.

## Final exit criteria

- [ ] One Flutter package in the same repo; root npm and Next.js structure preserved.
- [ ] Android guest home and all core gameplay/account screens are complete.
- [ ] Web and Android users complete a fair three-player match with current scenarios.
- [ ] Owner-only evidence and shared chat behave correctly under reconnect/account switch.
- [ ] Native session refresh, expiry, process death and revocation work without web regressions.
- [ ] Palette/components align with the approved UI; TalkBack, large text and small phones pass.
- [ ] Package-local Flutter tests, shared root fixtures, required CI and advisory emulator status, APK/AAB build and device evidence are recorded.
- [ ] Privacy/deletion/signing/store gates pass before public release.
- [ ] Voice remains the existing disabled BETA section; push is clearly enabled or deferred.

## Official references checked

- [Zod JSON Schema export](https://zod.dev/json-schema)
- [Dart verified publishers](https://dart.dev/tools/pub/verified-publishers)
- [Android adb](https://developer.android.com/tools/adb)
- [Flutter architecture guidance](https://docs.flutter.dev/app-architecture)
- [Android Flutter flavors](https://docs.flutter.dev/deployment/flavors)
- [Android builds and signing](https://docs.flutter.dev/deployment/android)
- [Flutter integration testing](https://docs.flutter.dev/testing/integration-tests)
- [Native testing limits](https://docs.flutter.dev/cookbook/testing/integration/introduction)
- [Nexconn Flutter Chat import](https://docs.nexconn.ai/chatsdk-flutter/import)
- [Nexconn Flutter Chat quickstart](https://docs.nexconn.ai/chatsdk-flutter)
- [Flutter FCM setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started)
- [FCM receipt and permission behavior](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages)
- [Android App Links](https://developer.android.com/training/app-links/about)
- [Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)

Recheck package/platform/store requirements during implementation. Referenced
architecture guidance informs separation of concerns; the proposed Flutter
controllers deliberately preserve this project's requested MVC terminology.
