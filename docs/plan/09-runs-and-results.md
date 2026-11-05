# Step 09 — Run Orchestration, Incident Phase, Results UI

**Goal:** wire the simulator into the match. Lock configuration, snapshot inputs, run the three fair simulations, deliver incident evidence between Run 2 and Run 3, and show the Run 2 vs Run 3 comparison with hard-gate verdicts. After this step three players can complete a full match with messaging and no voice or AI (design Step 3 exit test).

**Prerequisites:** Steps 04 (simulator), 07, 08.

---

## Tasks

### 9.1 Run orchestration (`services/runService.ts`)
`startRuns12(userId, matchId)`:
1. Member, host or lock holder, phase `REPAIR_1`, not already run (idempotent on `(matchId, runNumber)`).
2. Transaction: set `simulationLocked`, snapshot current configuration into `ConfigurationSnapshot` (content-addressed; reuse row on identical hash), record configuration version.
3. Build `InputBundle` for Run 1 (preset, **normal** incident profile) and Run 2 (preset, **incident** profile). Note: runs 1 and 2 use the **original preset**, per design section 4, regardless of what the squad edited. The configuration they edit in `REPAIR_1` is the *repair* used in Run 3.

> **Clarification to pin with a test:** edits in `REPAIR_1` form the *repaired design*. Runs 1–2 execute the preset. Run 3 executes the repaired design under the same incident as Run 2. Phase naming in code: `REPAIR_1` (propose repair) → `RUNS_1_2` (show baseline and failure) → `INCIDENT_EVIDENCE` → `REPAIR_2` (revise repair using new evidence) → `RUN_3`.

4. Call `packages/sim` for Run 1 and Run 2; persist `SimulationRun` rows with `inputHash`, snapshot id, engine and scenario versions, full result.
5. Release lock flag, advance to `INCIDENT_EVIDENCE` after results are shown (host or timer), triggering incident evidence generation (step 08).
6. Broadcast `run.completed { runNumber, summary }` (public summary only).

`startRun3(userId, matchId)`:
1. Phase `REPAIR_2`, holder/host, config locked, snapshot.
2. Load Run 2 inputs; build Run 3 bundle with **identical** incident, traffic, outage, retry pattern, engine version; only configuration differs.
3. Assert equality of the shared components by hash (`COMPARISON_INPUT_MISMATCH` otherwise, logged and surfaced as `INTERNAL`).
4. Run, persist, compute `compareRuns(run2, run3)`, advance to `COMPARE`.

Rules common to both:
- Sim runs in-process but off the request path via `setImmediate`/worker thread if runtime exceeds a threshold; a hard timeout aborts and marks the run `ERROR` safely.
- A match can have at most one run in progress (DB unique + in-memory guard).
- Results persisted before any broadcast.

### 9.2 Result views (`services/resultView.ts`)
- Maps stored results to DTOs for clients: metrics, gates, failure reasons, comparison. Contains no evidence and no hidden scenario internals beyond what the result itself reports.
- Run 1: labeled diagnostic baseline. Runs 2 and 3: labeled the fair comparison.

### 9.3 WS and HTTP
- `run.start` (client→server, payload `{ runNumber }` with allowed values per phase), `run.started`, `run.completed`, `match.phase`.
- `GET /api/game/matches/:id/runs` returns persisted runs for members.
- Rate limit `run.start`; disable button client-side during run.

### 9.4 Results UI (`apps/web/src/features/results`)
- **Baseline view** (Runs 1 and 2): metric cards, gates with pass/fail badges, failure reasons list (rule, evidence, configuration causes).
- **Incident evidence screen**: "New private evidence available" nudge, opens the player's private card; prompts them to share via chat.
- **Comparison view** (Run 2 vs Run 3): shadcn `Table` with before/after for duplicates, valid admissions by deadline, p95 latency, queue peak, app and DB utilization, cost, and hard gate status. Highlights changed gates and states trade-offs in words (for example "Duplicates fixed; cost now over budget").
- Failed hard gate always displays `FAILED`; diagnostic score (if shown) labeled diagnostic only.
- "Play again" returns to `/play`.
- No charts yet (polish later).

### 9.5 End of match
- `COMPARE → FINISHED` by host or timer; Nexconn system notice "match finished"; lobby retains read-only results.
- Optional playtest feedback form is deferred to step 12.

---

## Unit tests required

**runService (fake repos, real `packages/sim`, `FakeChatProvider`)**
- Full happy path across the service layer with three fake users: lobby → briefing → repair 1 → runs 1–2 → incident evidence → repair 2 → run 3 → compare → finished. Asserts phase at each step and rows persisted.
- Run 1 and Run 2 use preset config **even if the squad edited the configuration** (pinned by test).
- Run 3 uses the edited repaired config.
- Run 2 vs Run 3 shared-input hashes equal; tamper (change incident or traffic in the Run 3 bundle) → `COMPARISON_INPUT_MISMATCH`.
- Snapshot content-addressed: identical configs reuse the same snapshot row.
- Idempotency: calling `startRuns12` twice produces no duplicate rows and returns the stored results.
- Concurrency: two simultaneous starts → exactly one run executes.
- Simulation lock: config updates rejected during runs; allowed after completion in the correct phase.
- Wrong phase, non-member, non-authorized user → rejected.
- Sim error/timeout → run marked `ERROR`, lock released, match recoverable (can retry).

**Result views**
- DTO contains required fields; never contains evidence or `referenceRepair`.
- Comparison reflects `gatesChanged` and trade-offs from the sim.
- Failed gates always yield `FAILED` label even when metrics improved.

**Controllers/WS**
- Strict schema; `runNumber` outside allowed set for phase rejected.
- Authorization matrix for `run.start` and `GET runs`.
- Broadcast payload contains summary only.

**Web components**
- Comparison table renders before/after, gate badges, trade-off text for fixture results (including a "latency better but duplicates remain" fixture that must display FAILED).
- Evidence nudge appears after incident phase and opens only own card.
- Run button disabled while running and for non-authorized users.

**Property-ish test**
- For a range of random-but-seeded configurations (stable seed in test), service output equals direct `runSimulation` output (no service-level drift).

## Security checks
- [ ] Run inputs are built server-side only; clients choose nothing but the run number.
- [ ] Only authorized roles can start runs; phase enforced.
- [ ] Persisted inputs include hashes so tampering is detectable; mismatch is a hard error.
- [ ] Results visible to members only; evidence never joins result payloads.
- [ ] Sim execution bounded (timeout, step cap) so a bad config cannot hang the server.
- [ ] Audit rows for run starts with user and run number.

## Exit criteria
- Three real players (seeded accounts acceptable) finish a full match: private briefs, group chat, repair with pass-control, Run 1, Run 2, incident evidence, Run 3, comparison.
- The preset fails Run 2 for explainable reasons; a thoughtful repair can pass Run 3.
- Service-level full-match test green; services ≥ 90% coverage.
- **Design Step 3 exit test met** (full match using messaging, no voice or AI).
