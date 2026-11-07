# Step 13a — Nexconn voice provider proof

**Status:** proposed, 2026-11-07. Planning does not install packages, enable voice,
change runtime configuration or authorize paid calls.

Execution update (2026-11-07): dependency metadata, archive declarations and a
compile-only API probe were checked. [SDK notes and evidence](../voice-sdk-notes.md)
record **BLOCKED**: calling is owner-reported as likely enabled but unverified,
bounded spend is unconfirmed, the latest
Call SDK declares older exact chat/engine peers, and provider admission/revocation
plus live device audio remain unproven. Owner confirmed the core playtest and
approved the SDK in chat. This is not completion of the live proof or a GO for 13b.

**Prerequisites:** steps 01–12 complete, including a recorded successful step-12
core-loop playtest. Automated browser success is not a substitute for a playtest.
Get approval for the new `@nexconn/call` package before installing it. Confirm the
test app's audio service, pricing and permitted test spend before a paid trial.

**Estimate:** 1–2 focused developer days; timebox investigation to two days and
record GO, NO-GO or BLOCKED. Provider replies and device availability can add
calendar time. A missing security proof is BLOCKED, never an implied GO.

## Goal

Prove a private, three-member audio call using the current Singapore Nexconn
identity, with working chat alongside it. Do this before building the full voice
feature. Use dedicated adult test accounts and explicit microphone consent.

## Tasks

1. Inspect current official guides and the package's actual exports/peer
   dependencies. Record a pinned compatible engine/chat/call version set and
   exact install/initialize/connect order. The quickstart and older group guide
   use differing signatures; verify actual methods/events instead of copying
   snippets or inventing APIs.
2. Prove audio-only create, explicit accept, mute/unmute, leave, late third-member
   invitation and rejoin. Two consenting members are needed to start; do not
   create a paid call for one waiting member. Call signaling and text messaging
   must share the existing connection without disconnecting each other.
3. Attempt admission with an outsider, a removed member, an expired session and
   a replayed call ID, including direct provider SDK calls that bypass our API.
   Prove how the provider enforces authorized admission and how the server
   terminates/revokes audio. Never assume the existing chat token is scoped to
   one call. Resolve any missing controls with Nexconn; insecure client-only
   admission is NO-GO for release.
4. Verify that logout-all, session logout and confirmed expiry can stop provider
   audio even if the browser ignores app events or its game socket disconnects.
   Specify session-level and retained-session behavior; closing a WebSocket alone
   is not revocation. Record a measured termination bound and retry behavior.
5. Test HTTPS and normal Next client navigation from `/play` into a match. Record
   required Singapore network hosts, CSP/media/worker directives and permissions.
   Allow self microphone on every app HTML entry document when voice is enabled;
   requesting access still requires a deliberate Join. Keep camera disabled.
6. Run three separate devices/accounts with real audio. Check deployed desktop
   Chrome, Android Chrome, iPhone Safari and an installed iPhone PWA. Record
   relaunch permission behavior, phone-call interruption, backgrounding, screen
   lock, output playback and full track release. Do not promise continuous audio
   or persisted microphone grants on every iOS version.
7. Confirm provider billing starts/ends, server call termination, usage visibility
   and spending-alert/hard-limit support. Use at most two proof calls, five minutes
   each, and ten aggregate call-minutes; these are engineering test bounds, not
   a price guarantee. Apply a lower owner-approved spend cap if required. Record
   a conservative cost calculation using verified participant-minute pricing
   and the 13b runtime limits, including up to 60 seconds sweep delay plus provider
   teardown. No paid test begins without the confirmed budget.
8. Verify region/data routing, provider recording defaults, metadata retention
   and privacy documentation. Selecting SG alone is not proof of exclusive
   Singapore processing. Validate the proposed user notice before release;
   recording, transcription and voice push remain off in v1.

## Deliverable and decision

Create `docs/voice-sdk-notes.md` during execution with package versions, verified
API signatures, endpoint list, redacted test evidence, pricing/termination notes,
access-control design, real-device matrix, privacy facts and known limitations.
Never include real tokens, credentials, audio recordings or private clues.

- **GO:** audio, chat coexistence, provider admission/revocation, cleanup, budget
  controls and supported target-device behavior are proven. Record accepted
  device limitations and proceed to [13b](13b-squad-voice-build.md).
- **NO-GO:** essential privacy/access isolation or workable group audio cannot
  be supported. Keep the disabled BETA placeholder and text chat; document why.
- **BLOCKED:** version, service access, provider answers or device evidence is
  missing. Do not start 13b until the missing evidence produces a decision.

## Unit tests required

For any proof harness code retained: test SDK lifecycle cleanup, chat coexistence,
failure propagation and rejected provider admission with a mock adapter. Keep all
test helpers in root `tests/`. No permanent runtime endpoint is required for the
proof. If one is introduced, it must meet CLAUDE.md's unauthenticated, non-member,
wrong-role and wrong-phase test rule; test every permitted role explicitly.

Mocked tests do not prove live audio or provider security. Fake microphone
capture in CI is Chromium-only; real WebKit/iPhone media checks are manual.

## Security checks

- [ ] Dedicated consenting test accounts; explicit microphone action, no recording.
- [ ] App Secret stays server-only; no tokens/audio in notes or test artifacts.
- [ ] Direct-SDK outsider/replay tests demonstrate provider access isolation.
- [ ] Logout/expiry/removal terminate provider audio with measured bounds.
- [ ] Chat connection, nonce CSP and camera denial remain intact.
- [ ] Paid trial has a confirmed spend cap and explicit call termination.
- [ ] Any retained endpoint/event has the required authorization matrix coverage.

## Exit criteria

- [ ] Steps 01–12 and the core playtest gate are evidenced, not assumed complete.
- [ ] SDK notes and GO/NO-GO/BLOCKED decision exist with redacted evidence.
- [ ] GO requires real three-account audio plus proven provider admission/revocation.
- [ ] Device limitations, routing/privacy facts, cost bounds and alert support recorded.
- [ ] Every proof call is terminated, media tracks released and test resources cleaned.
- [ ] No production voice flag is enabled by the proof.

## Sources

- [Web Call SDK setup](https://docs.nexconn.ai/callsdk-web)
- [Group call flow and billing](https://docs.nexconn.ai/callsdk-web/group-call)
- [Chat integration](https://docs.nexconn.ai/callsdk-web/integrate-with-chat)
- [Versioned API reference](https://docs.nexconn.ai/apidoc/nexconncall-web/latest/)
- [WebKit report: Home Screen microphone re-prompts](https://bugs.webkit.org/show_bug.cgi?id=327237)

Recheck these during execution; a reported WebKit issue is a device-test input,
not proof of identical behavior across all iPhones.
