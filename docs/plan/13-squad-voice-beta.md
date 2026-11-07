# Step 13 — Squad voice BETA plan

Status: proposed, revised after review on 2026-11-07. This is planning only;
runtime code, dependencies, environment variables and active calls are unchanged.

**Prerequisites:** steps 01–12 complete, including the step-12 core-loop playtest
gate. Record evidence before starting voice; browser tests alone do not satisfy it.

| Step                                                | Outcome                                                              | Estimate                    |
| --------------------------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| [13a — Provider proof](13a-voice-provider-proof.md) | Verified SDK notes and GO / NO-GO / BLOCKED decision                 | 1–2 developer days          |
| [13b — Build](13b-squad-voice-build.md)             | Authorized squad audio, controls, cleanup, tests and limited rollout | 6–9 developer days after GO |

Estimates exclude provider support waits and device scheduling. A failed proof
stops the build; keep text chat and the disabled BETA placeholder available.

## Review decisions

- Allow `microphone=(self)` on all app HTML entry pages when enabled, since Next
  client navigation keeps the loaded document. Capture still requires explicit
  consent. Test `/play` -> Create -> Join voice, not just direct match loads.
- Reuse existing session/user revocation, authorized WebSocket delivery and
  `MaintenanceService.sweep`; add strict `voice.status` during 13b.
- Put numeric limits in server `runtimePolicy`: 2-minute under-population grace,
  45-minute maximum call, 3 starts/match, 10 starts/user/UTC day, 6 join attempts
  per minute, and 80% spending alerts on USD 5/day and USD 25/month budgets.
  13b specifies enforcement, persistence and sweep/billing-delay limitations.
- Add validated server-only `VOICE_ENABLED` (default off) and its credential-free
  `.env.example` entry during implementation, not as unused runtime code now.
- Add a versioned first-join privacy notice; verify provider routing/retention
  before describing Singapore processing. No recording, transcription or voice
  push notifications in v1.
- Test worker cache exclusion for call/media traffic. Use Chromium fake media
  only; real WebKit/iPhone audio and installed-PWA interruptions/re-prompts need
  manual device checks, with versions and limitations recorded.

Each substep includes Unit tests required, Security checks and Exit criteria.
The existing game rules, one root package, MVC layers, shared palette, Lucide
icons, root `tests/` folder and visible BETA tag remain the constraints.

The document-scoped permission rationale follows the
[microphone policy documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/microphone).
