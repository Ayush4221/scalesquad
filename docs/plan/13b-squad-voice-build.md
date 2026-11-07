# Step 13b — Build squad voice BETA

Status: proposed implementation plan, requested 2026-11-07. No runtime changes
or dependency installation are part of this planning task. Preserve the game
rules and complete the voice feasibility checks before enabling the feature.

**Prerequisites:** steps 01–12 complete, including the recorded step-12 core-loop
playtest gate, plus a GO decision and SDK notes from [13a](13a-voice-provider-proof.md).
Passing browser tests alone does not satisfy the playtest gate.

**Estimate:** 6–9 focused developer days after 13a passes, including automated
tests and real-device checks. Provider support waits are additional. This is an
estimate, not a commitment; unresolved admission/revocation blocks the build.

## 1. Intended experience

- One optional audio call per match, for its existing three members only.
- Two members can talk while waiting for the third; readiness does not gate voice.
- One member sees “Waiting for a teammate” without starting a paid empty call.
- Keep the BETA tag. Add Join voice, Mute/Unmute, Leave voice, participant state
  and connection feedback. Incoming invitations require an explicit user action.
- Join muted by default. Request microphone access only after the user chooses
  to join; request audio only. Show clear permission/device and playback errors.
- Preserve the call across lobby, briefing, repair and results, including mobile
  tab switches. Leaving voice leaves the game and text chat intact.
- Leave the call on match exit, logout, confirmed session expiry, FINISHED or
  inactive-match closure. Other phase transitions do not disconnect it.
- No recording, transcription, video, screen sharing or background-call promise
  in this first release. Voice sends no push notifications in v1. Text chat stays
  usable when calling fails.

## 2. Inputs from provider proof

Use only the pinned SDK version, admission/revocation design, verified Singapore
hosts and termination behavior recorded in 13a. Do not repeat or bypass that gate.
The new `@nexconn/call` dependency still requires owner approval before installation.

## 3. Shared connection lifecycle

The current `src/lib/nexconn/client.ts` owns a page-level engine and
`useSquadChat` closes its client on unmount/reconnect. Voice cannot safely start
an unrelated second engine or lose its signaling when chat reconnects.

- Extract a shared Nexconn session owner with serialized initialization,
  connection, token refresh and final teardown. Register the Call plugin in the
  order required by the installed SDK before connecting the shared engine.
- Mount a match-scoped communications provider above the lobby/phase branches
  in `MatchShell`. Chat and voice subscribe independently. Chat unmount, changing
  tabs or retrying chat must not hang up voice.
- Lazy-load browser-only media code without introducing a second initialization
  path. Register listeners once and remove them during final teardown.
- Use generation/abort guards so late async completions cannot reopen a call
  after Leave or logout. Prevent duplicate joins and duplicate media tracks.
- Initially permit one active voice tab per account/match. Test a second-tab
  attempt and implement a clear handoff/refusal using the verified provider
  session behavior and app coordination; never silently replace a live caller.

## 4. Server, DTOs and persistence

Keep MVC: voice controller -> voice service -> voice repository -> Prisma.
Proposed paths use the existing single-package structure:

| Responsibility                      | Proposed location                              |
| ----------------------------------- | ---------------------------------------------- |
| Request/response contracts          | `src/shared/dtos/voice.ts`                     |
| Strict zod inputs                   | `src/shared/validations/voice.schema.ts`       |
| Provider contract                   | `src/server/domain/voicePorts.ts`              |
| Provider/server adapter             | `src/server/infra/nexconnVoiceProvider.ts`     |
| Authorization and call coordination | `src/server/services/voiceService.ts`          |
| DB access                           | `src/server/repositories/voiceRepository.ts`   |
| HTTP boundary                       | `src/server/controllers/voiceController.ts`    |
| Shared SDK session and call adapter | `src/lib/nexconn/session.ts`, `voiceClient.ts` |
| Voice state and controls            | `src/features/voice/`                          |
| Unit, integration and browser tests | Root `tests/` tree                             |

Proposed operations: read voice status, request admission/start, leave and close.
Finalize route names and provider operations after the feasibility gate. Derive
user, permitted peers, region and call reference on the server; never accept an
arbitrary invitee list or trusted call ID from a browser.

Persist a minimal match-to-call reference, generation and lifecycle state through
a migration. Do not store audio or tokens. Serialize concurrent first-join requests
and reconcile provider failure with DB state; two teammates joining together must
not create two calls. Make retries and cleanup idempotent, and handle stale call
IDs, abandoned startup reservations and process restarts. Retain the documented
single-server deployment constraint unless separately redesigned.

Authorize every operation against the session and current membership; enforce
three seats and phase/lifecycle rules. Rate-limit starts and retries, cap one
active call per match, and expire abandoned/empty calls to limit cost. Publish
only safe voice status to match members. Never treat client presence as verified
provider membership. If webhooks are used, verify their documented authenticity,
deduplicate events and handle out-of-order delivery.

### Reuse existing events, revocation and maintenance

- Extend the existing auth revocation composition in `src/server/main.ts` so
  `revoked.user` / `Rooms.revokeUser` and session-scoped revocation trigger voice
  revocation too. Preserve `exceptToken` semantics on password change: revoke
  other sessions without disconnecting the retained session. Track the voice
  admission's session, not just its user ID.
- Wire confirmed expiry/missing-session results from the existing session/gateway
  authorization path into the same idempotent voice revocation service. A socket
  close alone cannot stop provider audio. Preserve the current transient-database
  error behavior; do not interpret a lookup failure as confirmed revocation.
- Extend `MaintenanceService.sweep` for FINISHED/inactive matches, under-populated
  calls, maximum duration and stale startup reservations. Reuse its bounded batches
  and retry behavior rather than a parallel cleanup loop. Terminate on finish or
  revocation immediately; maintenance is the retry/backstop, including restart recovery.
- Add a strict versioned `voice.status` envelope to `src/shared/events.ts`, with
  match ID, call generation/revision, bounded participant statuses and safe state.
  Exclude tokens, provider credentials and private evidence. Deliver through
  `Rooms.broadcast` / `sendAuthorized`, retaining membership and session checks.
  Initial fetch and reconnect resync must use the same DTO so missed events heal.

### Concrete BETA limits

Add these server-enforced values to `src/server/constants/runtimePolicy.ts` in
13b; persist counters/deadlines so restart cannot reset the caps:

| Policy key                    | BETA value and behavior                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `voiceMinimumParticipants`    | 2 consenting members before creating a paid call               |
| `voiceUnderpopulatedMs`       | 120,000 ms continuously below 2; end the call                  |
| `voiceMaxCallMs`              | 2,700,000 ms (45 minutes) from provider creation; end the call |
| `voiceMaxStartsPerMatch`      | 3 provider call creations over the match's lifetime            |
| `voiceMaxStartsPerUserPerDay` | 10 creations initiated per user per UTC day                    |
| `voiceJoinAttemptsPerMinute`  | 6 per user; joining an existing call is not a creation         |
| `voiceStartupReservationMs`   | 60,000 ms; reconcile or expire abandoned starts                |
| `voiceSpendAlertPercent`      | 80% of either budget below; alert the operator                 |
| `voiceDailyBudgetUsd`         | USD 5 app-wide per UTC day                                     |
| `voiceMonthlyBudgetUsd`       | USD 25 app-wide per UTC calendar month                         |

Reserve start quota atomically before provider creation; count successful calls
and unresolved timeout outcomes conservatively until reconciled. Two simultaneous
joins must share one reservation. Apply budgets to dev and production usage
together, or explicitly divide their allowances without increasing the total.
Configure provider spending alerts where supported; otherwise use verified usage
data/conservative participant-minute estimates with operator alerts. At 100%, deny
new starts and end active calls through the same cleanup service. Billing lag means
this is not a guaranteed invoice ceiling; record provider hard-limit support in 13a.
The current sweep runs every 60 seconds: maintenance-based deadlines can overrun by
up to one sweep plus provider termination time. Measure this bound and cost in 13a;
do not claim an exact 120-second disconnect. Failed cleanup must retry and alert.

## 5. Browser permissions and security

- Current `Permissions-Policy` explicitly has `microphone=()`. When voice is
  enabled, send `microphone=(self)` on all app HTML entry pages, including `/`,
  `/signin`, `/register`, `/play` and `/match/...`. Next client navigation keeps
  the current document; changing only the match response is insufficient. Keep
  camera/geolocation disabled. With voice off use `microphone=()` on fresh
  documents, and enforce the kill switch in the running client/provider too.
  Allowing the feature is not consent: request capture only on explicit Join.
  Test `/play` -> Create squad -> Join voice without a document reload, plus
  home/sign-in navigation into a match and direct match loads.
- Extend CSP only for hosts/media/worker requirements established by the proof.
  Preserve script nonces; do not add `unsafe-eval` or general wildcards.
- Keep App Secret server-only. Return an explicit public DTO allowlist and
  `no-store`; redact tokens and call credentials in logs and artifacts.
- Handle permission denied, no microphone, device busy/disconnected, blocked
  autoplay, unsupported browser and offline recovery with explicit retry/help.
- Stop microphone tracks and remote playback on teardown. Session expiry and
  membership loss must revoke provider access, not just hide the controls.
- Service workers must never cache microphone/media data, call admission/status
  responses, provider signaling or media traffic. Keep the static-asset allowlist;
  no background voice or voice push handler in v1.

### Feature flags and consent

In 13b add server-only `VOICE_ENABLED` to `src/server/config/env.ts` as a strict
boolean string, default false, and to `.env.example` with no credentials (a blank
entry may map to false). Expose only the resolved boolean capability through a
safe DTO; do not add `NEXT_PUBLIC_` credentials or flags that bypass server policy.
The operator kill switch disables new admissions and terminates existing calls.
Do not add unused runtime flags during this plan-only task.

Before the first Join, show a one-time, versioned notice with Continue/Cancel:
“Your microphone audio is shared with your squad through Nexconn. Calls are
configured for Singapore. ScaleSquad does not record or transcribe calls. You can
mute or leave at any time.” Verify provider data handling in 13a before publishing
that wording; selecting Singapore does not prove all processing stays there.
Link to the privacy page and explain provider metadata/retention accurately.
Store only acknowledgment/version per account; ask again when the notice changes,
but do not confuse acknowledgment with browser permission. Cancel must not invoke
capture or start a call. Add the same privacy statement to project docs. Because
students may use the app, validate the intended audience and any institution/age
requirements before a school rollout; make no unsupported compliance claims.

## 6. UI and recovery

Use the shared palette, existing buttons and Lucide icons. Keep three aligned
participant slots with name, joined/muted state and local “You” indicator. Show
speaking animation only if the SDK supplies a reliable signal, with reduced
motion support and no game-role leak before briefing.

Model states explicitly: disabled, idle, waiting, requesting permission, joining,
joined, reconnecting, leaving and failed. Separate busy flags for join, mute and
leave. Mute controls use `aria-pressed`, statuses use polite live announcements,
and touch targets stay at least 44px. A deafen/output-device control can follow
later if portable provider APIs support it.

Use bounded reconnect with backoff and a visible retry after exhaustion. Preserve
mute intent; after a reload or expired admission require another deliberate Join.
Offer “Tap to hear squad” if playback is blocked. Show mobile interruption or
background suspension honestly; do not promise continuing audio on locked phones.

## 7. Unit tests required

1. Unit tests: state transitions, duplicate-click guards, mute intent, stale async
   callbacks, listener cleanup and shared-engine ownership.
2. Server tests: every new endpoint and WebSocket event needs unauthenticated,
   non-member, wrong-role and wrong-phase tests, as CLAUDE.md requires. Where all
   members may act, explicitly test each allowed role and reject unauthorized
   targets rather than inventing a host-only restriction. Also cover removed members,
   strict schemas, three-seat cap, concurrent starts, rate limits, provider errors,
   stale references, restart recovery and idle-call cleanup.
3. Browser tests: mocked call adapter for deterministic CI; Chromium-only fake
   microphone devices for permission/media flow; join/leave/mute, denial, autoplay recovery, retry,
   phase/tab changes, logout, second-tab handling, responsive fit and keyboard use.
   Include normal client navigation from `/play`, consent Continue/Cancel, flag
   off, numeric quota boundaries, restart-persistent counters, and a controlled
   media/signaling fixture proving the service worker never caches call traffic.
   Mocked voice UI can run in WebKit; real WebKit microphone/audio testing is manual,
   not covered by Chromium fake-device flags.
4. Keep real secrets out of normal CI. Run existing chat, auth, lobby and full-match
   regressions on Chromium, Android emulation and WebKit. Mocked calls do not prove
   real audio delivery or provider-side security.
5. Manual gate: three real accounts on separate devices over deployed HTTPS in
   Singapore; verify two-way audio, headphones/echo, denied permissions, network
   interruption, refresh/rejoin, third-member arrival and complete microphone
   shutdown. Include Android Chrome, iPhone Safari and an installed iPhone PWA.
   Test relaunch and permission re-prompts, incoming phone calls, screen lock,
   background/foreground transitions and Bluetooth/device changes. Expect possible
   interruption/re-consent and offer recovery; record OS/browser versions and
   limitations instead of claiming all iPhones behave identically.
6. Release disabled by default behind a validated feature flag. Enable for a
   small test group only after the security and audio gates pass. A kill switch
   must stop active calls and release media, then restore the disabled BETA UI.

Before release update architecture, UI/mobile docs, environment examples and
implementation status. Definition of done: lint/types/build pass, relevant unit
and browser suites pass, real-device evidence recorded, no call leaks/cross-match
access, chat remains working, and BETA stays visible.

## Security checks

- [ ] 13a admission, replay rejection and provider revocation proof remains valid.
- [ ] Every new endpoint/event has the four authorization cases listed above;
      server `voice.status` delivery rejects expired sessions and non-members.
- [ ] Origin checks, strict schemas, three seats and atomic numeric limits enforced.
- [ ] Existing user/session revocation, except-token handling and expiry stop audio.
- [ ] No secret/token/evidence leakage in DTOs, events, logs, caches or test artifacts.
- [ ] App navigation permits explicit microphone consent; camera remains disabled.
- [ ] Consent cancel does not capture; recording/transcription/push remain off.
- [ ] Existing maintenance retries terminate finished/inactive/over-budget calls.
- [ ] Feature disabled and operator kill switch prevent/terminate provider calls.

## Exit criteria

- [ ] All prerequisites, including core playtest and 13a GO evidence, are recorded.
- [ ] Two/three-person voice works while chat and the full match loop stay usable.
- [ ] All required unit/authz/browser checks and lint/types/build pass.
- [ ] Real-device checks include installed iPhone PWA relaunch/interruption recovery.
- [ ] Provider access isolation, cost limits, spending alerts and cleanup are proven.
- [ ] Runtime flag/schema/example and architecture/privacy/mobile docs are updated.
- [ ] Small-group rollout is enabled only after these gates; BETA remains visible.

## Delivery order

Provider proof and approval -> shared SDK session -> authorized call coordination
and persistence -> voice controls -> failure/cleanup tests -> real-device trial
-> limited BETA rollout. Stop at a failed provider/security gate instead of
shipping an unprotected call flow.

## Official references checked

- [Web Call SDK setup](https://docs.nexconn.ai/callsdk-web)
- [Group call and rejoin flow](https://docs.nexconn.ai/callsdk-web/group-call)
- [Chat integration](https://docs.nexconn.ai/callsdk-web/integrate-with-chat)
- [Call SDK API reference](https://docs.nexconn.ai/apidoc/nexconncall-web/latest/)

The chat-integration guide documents local end-of-call logs for single calls
only; do not depend on that callback as the group-call cleanup authority.
