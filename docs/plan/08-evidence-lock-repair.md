# Step 08 — Private Evidence, Edit Lock, Repair Controls

**Goal:** make every player necessary. Deliver role-specific private opening briefs, enforce one-editor-at-a-time with pass-control, and implement the constrained repair panel with server-validated, versioned configuration. This is design sections 2 and 5.

**Prerequisites:** Step 07 (match, members, state machine, WS rooms). Scenario evidence definitions from step 02.

---

## Tasks

### 8.1 Evidence generation (`services/evidenceService.ts`)
- On entering `BRIEFING`: for each member, build the opening card from the scenario evidence definition for their role, rendering fact text from scenario values. Store one `PrivateEvidence` row per `(matchId, userId, phase)`.
- On entering `INCIDENT_EVIDENCE`: generate the incident card per role from the selected incident profile (design 2: traffic retry doubled/longer spike, data committed-timeout or stale replica, ops outage interval or budget shortfall). Each card carries a distinct, decision-relevant fact.
- Idempotent: regenerating for the same `(match,user,phase)` returns the existing row.
- Pure function `buildEvidenceCard(role, phase, scenario, incident)` separate from persistence.
- Public projection never contains evidence content.

### 8.2 Evidence access (`controllers/evidenceController.ts`)
- `GET /api/game/matches/:id/evidence` returns **only the caller's** cards for phases already reached.
- No endpoint accepts a `userId` parameter for evidence. The user is always the session user.
- On creation, send WS `evidence.available { phase }` via `sendToUser` (no content). Optional Nexconn private ping behind a feature flag, content-free, only if step 07 docs confirmed DM privacy.
- "Share" is a player action in chat; the UI never auto-posts evidence to the group.

### 8.3 Configuration model and validation (`services/configService.ts`)
- Allowed values come from `shared` enums: app capacity, DB capacity, atomic check-in, retry policy, cache (design 5). Reject anything else.
- `getConfig(matchId)` visible to all members (design: others can view current configuration).
- `updateConfig(userId, matchId, change, expectedVersion)`:
  1. member of match
  2. phase is `REPAIR_1` or `REPAIR_2`
  3. match not simulation-locked
  4. caller holds the edit lock (and lock not expired)
  5. `expectedVersion === current.version` else `VERSION_CONFLICT`
  6. validate change with zod (strict)
  7. in one transaction: insert new `Configuration` row (`version + 1`), update lock's `configurationVersion`, write `AuditLog`
- Config starts as the scenario `presetConfiguration` (the flawed preset). The preset is public (design section 2).
- `REPAIR_2` starts from the repaired configuration of `REPAIR_1`? **No:** Run 3 compares preset-vs-repaired; the second repair edits the configuration chosen after incident evidence. Starting point for `REPAIR_2` is the last configuration from `REPAIR_1` (documented decision; a test pins it).

### 8.4 Edit lock (`services/editLockService.ts`)
- One `EditLock` per match; holder initially the host when entering a repair phase.
- `passControl(userId, matchId, targetUserId)`: only current holder; target must be a member; updates holder, new expiry; broadcasts `lock.changed`.
- `reclaim(userId, matchId)`: host only; only when the holder's connection has been absent longer than the reclaim timeout (value from config; tracked via the `userDisconnected` hook and a stored `lastSeenAt`).
- Lock lease: expires after inactivity; any accepted edit or heartbeat extends it. Expired lock can be taken by the host only.
- All time via injected clock.
- Server records who owns the lock; the client UI is only a reflection.

### 8.5 Repair panel UI (`apps/web/src/features/repair`)
- Five controls using shadcn `Select`/`Switch`: app capacity, DB capacity, atomic check-in, retry policy, cache.
- Shows current editor badge, version number, and a "Pass control" dropdown listing members.
- Non-holders see read-only values updating live from `config.updated`.
- Inline cost preview computed from public tier info only if the scenario marks costs public; otherwise the Ops player's private evidence carries the cost breakdown (design 2). Default: **no cost preview** in UI.
- Optimistic UI is avoided: show pending state, apply the server-confirmed value; on `VERSION_CONFLICT` refresh and notify.
- Brief panel (`features/brief`): shows the player's own cards, with a private indicator and an "acknowledge" button that feeds the `BRIEFING→REPAIR_1` guard.

### 8.6 WS events added
Client→server: `brief.ack`, `lock.pass`, `lock.reclaim`, `config.update`.
Server→client: `evidence.available`, `config.updated`, `lock.changed`, `error`.
All schemas strict and in `packages/shared`.

---

## Unit tests required

**Evidence build (pure)**
- Each role gets only its own fact IDs; **no fact ID is present in two roles' cards** (re-asserted against built output, not just the definition).
- Values in text match scenario config numbers.
- Incident cards differ from opening cards and carry a new fact per role.
- Different incident profile → different incident card content.

**Evidence service/controller (fake repos)**
- Generated once per `(match,user,phase)` (idempotent).
- **Isolation matrix:** user B requesting user A's evidence by any route/param returns only B's cards; there is no way to pass a target user; direct repository call with wrong user returns nothing.
- Cards for phases not yet reached are not returned.
- `evidence.available` is sent only to the owner's sockets and contains no content (assert the payload shape).
- Evidence content absent from: room broadcasts, public match view, audit rows, logs (spy on logger redaction).
- Non-member: `FORBIDDEN`; unauthenticated: `UNAUTHENTICATED`.

**configService**
- Valid update increments version by exactly 1 and writes audit.
- Rejected: unknown field, invalid enum, non-holder, non-member, wrong phase, sim-locked, stale `expectedVersion`.
- Concurrent updates (two calls same expected version) → exactly one succeeds, other `VERSION_CONFLICT` (transaction/fake optimistic check).
- Cache-as-authority cannot be set through the API (field not accepted).
- `REPAIR_2` initial state equals last `REPAIR_1` config.

**editLockService**
- Initial holder is the host.
- `passControl`: only holder; target must be member; not self-pass no-op rule defined; holder change broadcast.
- Non-holder pass attempt → `LOCK_NOT_HELD`.
- Reclaim: non-host refused; host refused before timeout; host allowed after timeout (fake clock); allowed when lock lease expired.
- Disconnect hook updates `lastSeenAt`; reconnect before timeout cancels reclaim eligibility.
- Lock state survives restart (loaded from DB).

**Controllers/WS**
- Strict schema rejection for every new event and route.
- Authorization matrix (unauthenticated, non-member, wrong role, wrong phase) for `config.update`, `lock.pass`, `lock.reclaim`, evidence GET.

**Web components**
- Repair panel: holder can edit, non-holder inputs disabled, version conflict message appears, pass-control updates holder badge from event.
- Brief panel: shows private indicator, acknowledge calls handler once, never renders another user's data (props only contain own cards).

## Security checks
- [ ] **Evidence isolation test is mandatory and named** (`evidence.isolation.test.ts`); it runs in CI and blocks merges.
- [ ] No endpoint takes a user ID for evidence retrieval.
- [ ] Evidence never appears in WS broadcasts, group chat, notices, logs, or audit detail.
- [ ] Server validates every configuration field; client dropdown values are not trusted.
- [ ] Lock and version checks are inside the DB transaction (no check-then-act race).
- [ ] `referenceRepair` never reachable from any API response.
- [ ] Audit rows record user, action, and version only (no evidence content).

## Exit criteria
- Three players each see a **different** private brief; each can name one fact that changes a decision.
- Only the lock holder can edit; handoff works; all see live config updates.
- Reclaim works after a simulated disconnect past the timeout.
- Isolation, authorization, and concurrency tests pass; services ≥ 90% coverage.
