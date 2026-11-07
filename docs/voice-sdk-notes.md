# Step 13a — Voice SDK proof notes

Checked: 2026-11-07. **Decision: BLOCKED; not approved for 13b or release.**
The dependency/type/documentation investigation is done. Live audio, provider
isolation/revocation and real-device proof remain unexecuted. No paid calls were
made, no media was captured and no voice SDK was installed into the app.

## Owner confirmations and open inputs

| Gate                  | Evidence / state                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core-loop playtest    | Owner answered “yes” to the playtest-pass question in this chat; participant observations/results were not provided. Prior implementation status still says human playtesting pending. Treat this as owner confirmation, not an independently observed test. |
| New Call SDK          | Owner approved a compatible pinned Call SDK in this chat.                                                                                                                                                                                                    |
| Account credits       | Owner reports 10,000 credits; this is a balance, not an approved test-spend cap or verified rate.                                                                                                                                                            |
| Audio service         | Owner now believes calling is enabled. Treat this as likely enabled, pending a Console confirmation or live provider test; no successful call has been observed.                                                                                             |
| Trial budget          | No explicit credit/currency spend cap confirmed.                                                                                                                                                                                                             |
| Real accounts/devices | No three-account call or desktop/Android/iPhone device session executed.                                                                                                                                                                                     |

## Package investigation — verified without installation

Read npm metadata and downloaded the public `@nexconn/call@26.2.1` archive with
`npm pack --ignore-scripts` into ignored `.cache/voice-proof/`. Inspected its
`package.json` and `index.d.ts`; did not execute its JavaScript or lifecycle hooks.

| Package                  | Version | Declared compatibility                                 |
| ------------------------ | ------- | ------------------------------------------------------ |
| App's current chat       | 26.2.1  | Requires engine exactly 26.2.1                         |
| App's current engine     | 26.2.1  | Existing app dependency                                |
| Inspected Call SDK       | 26.2.1  | Requires chat exactly 26.2.0 AND engine exactly 26.2.0 |
| Call SDK 26.2.0 metadata | 26.2.0  | Also requires chat/engine exactly 26.2.0               |
| Chat 26.2.0 metadata     | 26.2.0  | Requires engine exactly 26.2.0                         |

Thus, `call@26.2.1 + chat@26.2.0 + engine@26.2.0` is a **declared-peer-compatible
candidate**, not runtime-proven. It would downgrade current app chat/engine.
No changes were made to the app's package manifest/lockfile for voice. Do not use
`--force`, `--legacy-peer-deps`, or an override to claim the current 26.2.1 trio is
supported. Resolve the mismatch with Nexconn, or validate an explicitly selected
compatible set with complete chat/auth/full-match regression coverage before use.

Archive identity:

- SHA-256: `f9c392bb4656f23e1d13bf15564e1b7e6907bd24d7c3ac972b968f08339057b7`
- npm integrity: `sha512-hGizg9GGBokmwlYK9fm4HViUaV2J39HmW5yJb4r8MXom+KlLNvJSiYQolrcdFBzjfWDiA0HGdPvf1Z1NOZmOPQ==`
- Registry reference: [Call SDK 26.2.1](https://www.npmjs.com/package/@nexconn/call/v/26.2.1).

## API declarations — checked against the archive

| Operation                          | Actual 26.2.1 declaration shape                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Install plugin                     | `NCCallEngine.install()` before `NCEngine.initialize(...)`                                         |
| Initialize call singleton          | `NCCallEngine.initialize({})`                                                                      |
| Call listeners                     | `setCallEventHandler(handler)`; replaces the prior handler                                         |
| Required listener methods          | `onCallReceived`, `onCallConnected`, `onCallEnded`                                                 |
| Connect signaling                  | Existing `NCEngine.connect({ token })`                                                             |
| Start audio group                  | `startCall({ calleeIds, callType: NCCallType.MULTI, mediaType: NCCallMediaType.AUDIO })`           |
| Accept invitation                  | `acceptCall({ callId })`                                                                           |
| Join ongoing call                  | `joinCall({ callId })`                                                                             |
| Invite late member                 | `inviteToCall({ calleeIds })`                                                                      |
| Local mute                         | `enableMicrophone(false)`; unmute uses `true`                                                      |
| Local hang-up                      | `endCall({ callId })`                                                                              |
| Group server call-log notification | Optional `onServerCallLogReceived(event)` exists; local call-log callback remains single-call only |

A compile-only probe using the extracted declarations and current installed Chat
types **passed** strict TypeScript checking. It checked the operations above and
asserted that the old positional `startCall(...)` example is rejected. This is a
declaration compatibility check, **not** package-peer validation or runtime audio.
The probe is disposable under `.cache/voice-proof/api-probe.ts`; it was never run.

Command used:

```sh
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext .cache/voice-proof/api-probe.ts
```

Important mute constraint: SDK comments describe microphone-on after connection.
An `enableMicrophone(false)` call after joining may allow an initial audio burst.
The proof must establish a supported pre-publication mute mechanism before the
app can promise “join muted”; the inspected parameter shapes do not establish it.

## Access-control and termination findings

**Release blocker:** the extracted declaration explicitly describes joining an
ongoing call by its ID without an invitation. `NCCallJoinCallParams` contains only
`callId`, not a room-scoped admission credential. This is not a live exploit test,
but it invalidates the assumption that invitation-only app UI protects admission.

No public administrator kick/destroy or room-scoped admission method was found
in the inspected Call engine declarations. That does not prove the provider lacks
such server capabilities. The current [Server Call API landing page](https://docs.nexconn.ai/server-call-api)
documents webhooks and says further server topics will be added. Supported server
admission/revocation/termination APIs still need confirmation and actual tests.

The [linked security page](https://docs.nexconn.ai/callsdk-web/security/mfa) is
about Console MFA, not runtime call authorization. It cannot satisfy this gate.

The [Call webhooks guide](https://docs.nexconn.ai/server-call-api/webhook/overview)
documents lifecycle notifications, duplicates/retries and unordered delivery.
Notifications are not an admission decision or a termination API. Its stated
signature formula covers secret/nonce/timestamp, not the body; do not assume it
cryptographically binds payload contents. Confirm the integrity model with the
provider before using webhook data as authoritative membership or billing input.

Questions that must be resolved before GO:

1. Which version set is supported with this app's chat/engine 26.2.1?
2. How is a known call ID prevented from admitting outsiders or removed users?
3. Which authenticated server API revokes one session/user and terminates a whole
   call when clients ignore events? What is its measured maximum teardown delay?
4. How can initial microphone publication be disabled before joining?
5. How are webhook payload integrity, replay handling and event reconciliation
   secured? Which provider state query verifies active membership?
6. Which Singapore signaling/media/TURN endpoints and CSP directives are required?
7. What are this account's call rates/credit conversion, spending alerts and hard
   limits? Are recording/transcription off and what metadata/retention applies?

These questions are recorded for review; no support message was sent.

## Network, cost and privacy evidence

| Requirement                            | Result                                                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SG chat hosts                          | Existing app allows regional light-api/light-edge HTTPS/WSS families; that is not a verified voice allowlist.                                                                                                                                            |
| Voice signaling/media/TURN/CSP         | Not captured; service unavailable for live proof. Do not add guessed hosts.                                                                                                                                                                              |
| Browser entry-page policy              | Current app denies microphone. 13b must allow self microphone across app HTML entry documents while enabled; do not relax headers during this blocked investigation.                                                                                     |
| Billing trigger                        | Group guide says billing begins on successful group creation.                                                                                                                                                                                            |
| Actual call price / credits conversion | Unverified. Chat pricing/moderation rates must not be used as call rates.                                                                                                                                                                                |
| Trial upper bound                      | Two calls × five minutes × three participants = 30 participant-minutes, before teardown overhead. At three participants, one extra minute on both calls adds 6 participant-minutes. Cost is duration × verified rate; no money estimate is possible yet. |
| Region / retention / recording         | SG is the requested region. Exclusive SG processing, metadata retention and provider recording defaults remain unverified.                                                                                                                               |

## Live proof matrix

All rows below are **NOT RUN**, not failed or passed:

| Case                                    | Required evidence                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Three-way audio plus text chat          | Two-way sound for every account; simultaneous chat delivery                  |
| Two players and late third member       | One call; explicit accept; correct membership                                |
| Outsider / replay / removed member      | Provider rejects direct SDK admission, not just app HTTP                     |
| Logout / expiry / ignored client events | Provider audio stops within measured bounds                                  |
| Initial mute / leave / rejoin           | No pre-mute transmission; tracks and playback fully released                 |
| Normal `/play` client navigation        | Explicit microphone permission and successful capture                        |
| Desktop Chrome / Android Chrome         | Real hardware, network interruption and recovery                             |
| iPhone Safari / installed PWA           | Relaunch, permission re-prompts, lock, interruption, background and recovery |
| Cost cleanup / spend alerts             | Calls ended at provider; reconciled usage and alert evidence                 |

## Next permitted action

Confirm service enablement and a bounded trial allocation, resolve the supported
version set and provider security questions, then run the matrix on consenting
accounts/devices. Until evidence exists, keep 13a BLOCKED and 13b unstarted.
No runtime code or production permission changes are needed for this result.
