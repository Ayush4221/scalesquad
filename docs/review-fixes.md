# Active review fixes — 2026-11-06

The owner requested fixes to the original ten security findings, then added the
following twenty cleanup/UI/security findings. Existing approved designs and
8-character uppercase/number/symbol password policy remain authoritative.

## Original security findings

| #   | Finding                                                | Status                                        |
| --- | ------------------------------------------------------ | --------------------------------------------- |
| S1  | IPv6 rotation and bucket exhaustion                    | Implemented; focused tests pass               |
| S2  | Unverified password signup blocks verified OAuth owner | Implemented; isolated OAuth DB checks pass    |
| S3  | Per-account throttling and backoff flood reset         | Implemented; focused tests pass               |
| S4  | Production trusted proxy setting required              | Implemented; focused tests pass               |
| S5  | Short email local parts reject most passwords          | Implemented; focused tests pass               |
| S6  | Repeated outbound WS session/match reads               | Implemented; socket cache/fan-out tests pass  |
| S7  | Password plan conflicts with owner-approved policy     | Plan updated to owner-approved 8+ composition |
| S8  | Login form misreports outages/rate limits              | Implemented; focused tests pass               |
| S9  | Account-specific failure writes leak timing            | Implemented; equal failure-write work tested  |
| S10 | Failed simulator compilation cached until restart      | Implemented; focused tests pass               |

## Added cleanup and experience findings

| #   | Finding                                               | Status                                                           |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| N1  | Central friendly error-code messages                  | Implemented; final regression checks pass                        |
| N2  | API non-JSON errors and bounded request timeout       | Implemented; final regression checks pass                        |
| N3  | Dynamic match/document scenario title                 | Implemented; final regression checks pass                        |
| N4  | Per-action run loading labels                         | Implemented; final regression checks pass                        |
| N5  | Repair uses server-provided choices                   | Implemented; final regression checks pass                        |
| N6  | Clear stale errors on success/newer revisions         | Implemented; final regression checks pass                        |
| N7  | Format utilization as percentages                     | Implemented; focused tests pass                                  |
| N8  | Coherent domain/infra/utils/constants structure       | Implemented; final regression checks pass                        |
| N9  | Remove rate-limit re-export shim                      | Implemented; final regression checks pass                        |
| N10 | Split MatchShell into hook and focused components     | Implemented; focused component/service checks pass               |
| N11 | Separate navigation/status/metric components          | Implemented; focused component/service checks pass               |
| N12 | Object-based routes, compile route regex once         | Implemented; final regression checks pass                        |
| N13 | Consistent feature styling; remove unused landing CSS | Implemented; Tailwind recipes replace landing/global feature CSS |
| N14 | Nonce-based production Next CSP                       | Verified; nonce/header and browser CSP checks pass               |
| N15 | Document single-process coordination/scaling limit    | Implemented; final regression checks pass                        |
| N16 | Readable repair labels and explanations               | Implemented; focused component/service checks pass               |
| N17 | Results configuration diff and metric direction       | Implemented; focused tests pass                                  |
| N18 | Teammate roles after lobby, no private evidence       | Implemented; focused component/service checks pass               |
| N19 | Form labels, decorative glyphs, copy feedback         | Implemented; focused component/service checks pass               |
| N20 | Readiness/connection state and client navigation      | Implemented; focused component/service checks pass               |

## Validation

Final checks (2026-11-07): all 428 unit/component/service tests and all 36
browser checks pass. Browser checks cover desktop, Android and iPhone, including
public navigation, CSP nonces and hydration, selected missions, the full match
loop, retry after an outage, configuration changes and private clue drafts.
Production build, client/server TypeScript, lint and formatting pass. Screenshots
were inspected. The personal database was not changed. Earlier isolated DB
checks covered verified OAuth recovery and preservation of verified accounts.

## Follow-up seven findings — 2026-11-07

- N1: the per-account quota is charged only after password verification fails.
  Correct credentials are checked even when attackers exhausted the failure quota.
  The HTTP middleware also no longer charges an account-wide quota before
  verification. A real HTTP regression test exhausts the failure quota from
  different addresses, then signs in successfully with the owner’s password.
  Existing source-IP quotas and bounded failure delays remain in force.
- N2: a transient session-store failure no longer marks every cached socket invalid.
  Previously confirmed identity remains bounded by its stored expiry; the next due
  check retries. Missing, changed-owner and expired sessions still invalidate.
- L3: root metadata is generic `ScaleSquad`; the match screen retains the selected
  scenario title. The old imperative document-title effect is removed, avoiding
  a race with streamed Next metadata. Browser checks cover both public pages and selected missions.
- T8: Node helpers and runtime policy now live in `src/server/utils` and
  `src/server/constants`. Public helper folders contain no server subfolders.
  The empty legacy server lib folder is removed. ESLint rejects View imports of
  both server helpers and server constants.
- T11: removed `MatchNavigation.tsx`; production and test callers import the
  dedicated navigation, status and safe-area components directly.
- P13: deleted the active landing stylesheet. `globals.css` is now 103 lines of
  Tailwind registration, base accessibility and reduced-motion rules. Feature
  styles use token-based Tailwind recipes; no `.error`, `.muted` or landing
  selectors remain global. See `styling.md`.
- U17: the results comparison requires both configuration props and shows
  “What you changed”, including readable before/after values and the unchanged
  state. Full-match browser coverage asserts the actual atomic-check-in diff.

Focused regressions and the full 428-test unit/component/service suite pass.
All 36 browser checks pass on the final production build, including the results
diff on desktop and phones. Build, client/server TypeScript and lint pass.
