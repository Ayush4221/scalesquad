# Step 03 — Simulator Core

**Goal:** implement the deterministic rules engine in `packages/sim` as pure functions, rule by rule, each with exhaustive unit tests. Design doc section 1 is the spec. No UI, no DB, no network.

**Prerequisites:** Step 02 complete (config and types exist).

---

## Purity rules (enforced)
- No `Date`, `Math.random`, `process`, `fs`, `fetch`, or `node:` imports in `src/` (lint rule plus a test that greps the source tree).
- Time is the simulation clock (integer seconds, optional ms offsets inside a second).
- Any "randomness" is a deterministic function of inputs (for example hash of pass ID), never a runtime RNG.
- All numbers come from the scenario config passed in.

## Module layout

```
packages/sim/src/
  types.ts            InputBundle, State, ScanEvent, Result types
  clock.ts            step iteration helpers
  traffic.ts          expand traffic series -> ordered ScanEvents (deterministic)
  passStore.ts        PassRecord state: UNUSED -> ACCEPTED only
  checkin.ts          atomic and non-atomic check-in paths
  retry.ts            gate timeout and retry policies
  queue.ts            backlog counter, worker throughput, QUEUE_FULL
  gates.ts            ONLINE/OFFLINE, pending scans, reconnection replay
  capacity.ts         app and DB utilization, saturation flags
  latency.ts          base latency + queue wait + bounded overload penalty
  cost.ts             price table sum, budget check
  cache.ts            non-authoritative reads; cache-as-authority detection
  stats.ts            p50/p95 (nearest-rank, documented)
  step.ts             one-second step orchestration
  index.ts
```

---

## Tasks (one rule at a time; test first)

### 3.1 Types and traffic expansion
- Define `InputBundle` (immutable): `scenarioVersion`, `configuration`, `trafficProfileId`, `incidentProfileId`, `retryPolicy`, `engineVersion`.
- `traffic.ts`: convert attempts/s series into an ordered list of `ScanEvent { t, gateId, passId, requestId, idempotencyKey }`. Pass assignment is deterministic (index-based). Inject the configured simultaneous-scan pair at its configured second.

### 3.2 Pass store and atomic check-in (design 1.2, 1.3)
- `PassRecord { passId, state, acceptedRequestId?, acceptedGateId? }`. No transition back to `UNUSED`.
- **Atomic ON**: single indivisible `acceptIfUnused`. Second request gets `ALREADY_USED` (valid rejection, counted in `rejectedAlreadyUsed`, not an error).
- **Atomic OFF**: model read-then-write. Requests whose read times fall inside `raceWindowMs` of each other both read `UNUSED`, both write, both report success. Extra successes increment `duplicateAdmissions`.
- Deterministic overlap for the configured simultaneous-scan test.

### 3.3 Timeout after commit and retries (design 1.4)
- Gate timeout compares end-to-end latency with `timeoutMs`.
- If DB committed but response exceeds timeout: DB state stays `ACCEPTED`; gate observes `TIMEOUT`. Track "DB state" and "gate-observed outcome" separately.
- Retry policies:
  - `NO_RETRY`: nothing further.
  - `RETRY_SAME_KEY`: retry reuses `idempotencyKey`; server returns original outcome, no new admission.
  - `RETRY_NEW_IDENTITY`: retry is a new operation; with atomic ON returns `ALREADY_USED`; with atomic OFF may create duplicate.
- Counters: `timedOutRequests`, `retriedRequests`, `retrySuccesses`.
- Idempotency store keyed by key → original outcome.

### 3.4 Queue (design 1.5)
- Backlog `B(t+1) = max(0, B(t) + A − W)` with worker rate `W`.
- Above `maxBacklog` → `QUEUE_FULL` for excess.
- Queue wait (`B / W`) added to latency.
- Queue does not affect atomicity.
- Track `queuePeak`, `queueRejected`.

### 3.5 Gate connectivity (design 1.6)
- Per-gate `ONLINE|OFFLINE` per second from scenario outage profile.
- Offline: scan becomes `PENDING_NOT_CONFIRMED`, held locally, never counted as admitted.
- On reconnect: replay pending scans in deterministic order with their **original** idempotency keys; server decides.
- Late confirmations after `deadlineSeconds` do not count toward valid admissions.
- Track `pendingAdmissions` (still unconfirmed at end).

### 3.6 Capacity, latency, cost (design 1.7)
- `appUtilization = appRequests / appCapacity`; `dbUtilization = dbWrites / dbWriteCapacity`; track peaks.
- Overflow handling: wait if buffered (queue), else `APP_OVER_CAPACITY` / timeout.
- Latency: base per stage + queue wait + penalty:
  - util ≤ `overloadStartUtil`: 0
  - up to `steepStartUtil`: linear ramp
  - above: steep penalty and `SATURATED` flag
- `p50`, `p95` by nearest-rank over successful and timed-out request latencies (document the choice).
- Cost: sum tier costs + cache + queue; `budgetMet = totalCost <= budgetLimit`.
- Increasing DB capacity must **not** change correctness (test explicitly).

### 3.7 Cache (design 5)
- Cache accelerates non-authoritative reads only; reduces read latency.
- If configuration marks cache as authority for check-in, simulation records a correctness failure `CACHE_USED_AS_AUTHORITY` regardless of other metrics. (Players cannot select this; test with a crafted bundle.)

### 3.8 Step orchestrator
- `step.ts` advances one second: gates update → arrivals → queue → app → DB → responses → retries → counters.
- State is a plain object; each step returns a new state (no hidden mutation) so tests can inspect any second.

---

## Unit tests required (the heart of this step)

For every rule below, write tests **before** the implementation.

**Pass state and atomicity**
- Atomic ON: two gates scan same pass → exactly 1 valid, 1 `ALREADY_USED`, 0 duplicates.
- Atomic OFF with overlap inside race window → duplicate count = 1.
- Atomic OFF without overlap (outside window) → no duplicate (race is real, not unconditional).
- 3-way overlap atomic OFF → 2 duplicates.
- State never returns to `UNUSED`.
- `ALREADY_USED` is not counted as an error or timeout.

**Timeout and retries**
- DB commits, response late → DB `ACCEPTED`, gate sees `TIMEOUT`.
- Same key retry → original outcome, no new admission, `retrySuccesses` increments.
- New identity retry + atomic ON → `ALREADY_USED`, 0 duplicates.
- New identity retry + atomic OFF → duplicate recorded.
- `NO_RETRY` → no retried requests.
- Retry after rollback-not-possible: committed write persists.

**Queue**
- Arrivals < workers → backlog 0.
- Arrivals > workers → backlog grows exactly per formula (golden numbers).
- Backlog above limit → `QUEUE_FULL` count equals excess.
- Queue wait appears in latency.
- Queue on + atomic OFF still produces duplicates (queue is not correctness).

**Gates**
- Offline scan → `PENDING_NOT_CONFIRMED`, not valid.
- Reconnect replays with original key; if another gate already accepted → `ALREADY_USED`.
- Pending after deadline does not count as valid.
- Fail-closed: no local acceptance ever recorded.

**Capacity, latency, cost**
- Utilization math at boundary values (0.7, 0.9, 1.0, >1).
- Penalty: zero at ≤0.7, monotonic increasing, steep above 0.9, `SATURATED` flag set.
- p50/p95 on known arrays (including 1 element, ties, empty).
- Cost sum per tier combination; budget boundary (equal passes, +1 fails).
- DB capacity HIGH with atomic OFF still produces duplicates.
- Cache as authority → `CACHE_USED_AS_AUTHORITY`.

**Purity**
- Source-tree grep test: no `Date`, `Math.random`, `process.`, `node:`, `fetch` in `src/`.
- Input bundle is not mutated by a run (deep-equal before/after, frozen inputs).
- Same inputs run twice → deep-equal state at every second (property: determinism).

## Security checks
- [ ] Sim accepts only validated bundles (zod parse at entry); malformed bundle throws typed error.
- [ ] Bounded loops: step count capped by `deadlineSeconds + grace`; huge traffic series rejected by schema limits (no DoS via config).
- [ ] No dynamic code evaluation, no `eval`/`Function`.

## Exit criteria
- 100% line and branch coverage on rule modules in `packages/sim`.
- Every rule in design doc 1.2–1.7 has a named test.
- Team can explain each modeled failure and its cause with no UI (design Step 1 exit test).
