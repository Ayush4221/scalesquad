# Step 07 — Match Lifecycle, Lobby, Nexconn Group Chat

**Goal:** create/join matches by code, assign the three roles, drive the server-owned phase state machine, and give the squad a working Nexconn group chat in the lobby. First playable slice: three signed-in players can enter a lobby, chat, ready up, and start.

**Prerequisites:** Steps 05–06.

---

## Tasks

### 7.0 Read Nexconn documentation (blocking)
Before writing any Nexconn code, read the current official Nexconn Chat docs (web SDK and server API). Record in `packages/nexconn/README.md`:
- SDK package name, init flow, auth token mechanism, group channel creation, join, message events, history, rate limits.
- Whether direct/private messaging is truly private and persisted (needed only for the evidence ping in step 08).
- If any required capability is unclear or unavailable: **stop and ask the project owner**. Do not guess API names.

### 7.1 Nexconn adapter (`packages/nexconn`)
- `ChatProvider` interface (server side): `createGroup(matchId, members)`, `addMember`, `removeMember`, `mintUserToken(userId)`, `sendSystemNotice(groupRef, notice)`, `deleteGroup`.
- `FakeChatProvider` (in-memory, deterministic) used by every unit test.
- `NexconnChatProvider` real implementation using server credentials from env; timeouts and retries with bounded backoff; errors mapped to `AppError` (`UPSTREAM_UNAVAILABLE`), never leaking upstream bodies.
- Web side `lib/nexconn`: thin wrapper around the SDK exposing `connect(token)`, `onMessage`, `sendMessage`, `history`. Behind an interface so components can be tested with a fake.

### 7.2 Repositories
`matchRepository` (create, findByJoinCode, findById, updatePhase with expected-phase check), `memberRepository` (add, setReady, listByMatch, findByUser), `nexconnMappingRepository`, `auditRepository`.

### 7.3 Join codes (`lib/joinCode.ts`)
- Generated with `crypto.randomInt`; 8 characters from an unambiguous alphabet (no 0/O/1/I) ≈ 40 bits.
- Stored normalized (uppercase). Valid only while match is in `LOBBY`; expire after a configured TTL.
- Uniqueness retry on collision (bounded).

### 7.4 State machine (`services/matchStateMachine.ts`, pure)
- Transition table from architecture section 6:
  `LOBBY → BRIEFING → REPAIR_1 → RUNS_1_2 → INCIDENT_EVIDENCE → REPAIR_2 → RUN_3 → COMPARE → FINISHED`
- `canTransition(from, to, context)`; guard conditions as pure predicates (all three roles filled and ready for `LOBBY→BRIEFING`; all briefs acknowledged or timer elapsed for `BRIEFING→REPAIR_1`; etc.).
- Phases that require timers expose `deadlineAt`; the service schedules timers and persists deadline so a restart can resume.

### 7.5 `matchService`
- `createMatch(userId)`: creates match, host membership, join code, Nexconn group + mapping (compensating cleanup if Nexconn fails after DB write: use transaction + best-effort rollback of group).
- `joinMatch(userId, code)`: validates code/phase/capacity (max 3), idempotent for existing member, assigns role. Role assignment: deterministic and unpredictable-enough; host can't see others' roles beyond what's public. Provide `assignRoles` pure function (seeded by matchId so tests are deterministic).
- `setReady(userId, matchId, ready)`.
- `startMatch(userId, matchId)`: host only; requires 3 members with all three roles and ready; transitions `LOBBY→BRIEFING`; sends Nexconn system notice (no private content); writes audit row.
- `leaveMatch`, `getPublicView(userId, matchId)` (membership required; public fields only).
- Every method takes `userId` and re-checks membership/role/phase (deny by default).

### 7.6 Controllers and routes
HTTP: `POST /api/game/matches`, `POST /api/game/matches/join`, `GET /api/game/matches/:id`, `POST /api/game/matches/:id/ready`, `POST /api/game/matches/:id/start`, `POST /api/game/nexconn/token` (member-only; returns short-lived token for that user).
WS events: `match.subscribe` (membership-checked room join, replies with state snapshot), server pushes `match.phase`, `match.members`.
Rate limits: join attempts strict (per IP and per user) to stop code brute force.

### 7.7 UI (`apps/web`)
- `/play`: Create match, Join with code (shadcn Input, Button).
- `/match/[id]` lobby: roster with ready badges, host Start button (disabled until valid), join code with copy button, connection badge.
- `features/chat`: group chat panel (Nexconn), degraded banner if Nexconn is unavailable; game still works.
- Phase-aware shell component that renders the right screen per `match.phase` (placeholder screens for later phases).
- Roles are hidden in lobby; they reveal on `BRIEFING` (own role only).

---

## Unit tests required

**State machine (exhaustive)**
- Every legal transition succeeds when guards hold.
- Every illegal transition (full from×to matrix) is rejected.
- Guards: missing role, not all ready, missing acknowledgements → rejected.
- Terminal state `FINISHED` has no outgoing transitions.

**Join code**
- Length, alphabet, no ambiguous characters.
- Distribution sanity (no fixed prefix) over many samples with a stubbed RNG.
- Collision retry stops after the bound and throws.
- Lookup is case-insensitive and trims whitespace.

**Role assignment**
- Always yields one of each role for three members; deterministic for a given seed; different seed → can differ.

**matchService (fake repos and `FakeChatProvider`)**
- create → member, code, group created, mapping stored.
- Nexconn failure on create → no orphan match (rolled back) and `UPSTREAM_UNAVAILABLE`.
- join: valid; invalid code; expired code; match not in `LOBBY`; full match (4th user); already a member (idempotent).
- ready toggle; non-member cannot toggle.
- start: host only; non-host → `FORBIDDEN`; fewer than 3 → rejected; not all ready → rejected; success transitions and writes audit.
- Authorization matrix for every method: unauthenticated, non-member, member wrong role, wrong phase.
- Timer scheduling persists `deadlineAt`; restart recovery re-arms timers (fake clock).

**Controllers**
- Validation rejects unknown keys, bad code format, missing fields.
- Rate limit applied on join (brute force simulation hits limit).
- Token endpoint: non-member refused; member gets token only for self.

**WS**
- `match.subscribe` by non-member refused; member receives snapshot filtered to public view.
- Phase broadcast reaches only room members.

**Web components (Testing Library, fake WS and fake Nexconn)**
- Lobby renders roster, ready state, enables Start only for host when valid.
- Chat shows messages, handles send failure, shows degraded banner.
- Phase shell renders the correct screen per phase.

## Security checks
- [ ] Join code brute-force limited and expiring; codes never logged at info level with user attribution beyond audit.
- [ ] Only members receive match room events; snapshot is filtered.
- [ ] Nexconn app secret server-only; client receives only a per-user short-lived token.
- [ ] Nexconn system notices contain no private data.
- [ ] Group membership mirrors DB membership (no one in chat who is not a member); removal on leave.
- [ ] Audit rows for create, join, start.
- [ ] Host cannot read other members' roles before `BRIEFING` through any endpoint.

## Exit criteria
- Three browsers (three real or seeded accounts) create, join, chat, ready, and the host starts the match; all see `BRIEFING`.
- State machine matrix tests pass; services ≥ 90% coverage.
- Killing Nexconn access (invalid key in dev) shows the degraded banner but the lobby still functions.
