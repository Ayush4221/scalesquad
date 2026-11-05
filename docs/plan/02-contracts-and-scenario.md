# Step 02 — Contracts and Scenario Config

**Goal:** define shared types, zod schemas, error codes, hashing, and the versioned CampusPass scenario config. This is design doc Step 1 ("Rules"): every number lives in config, none in code.

**Prerequisites:** Step 01 complete.

---

## Tasks

### 2.1 `packages/shared`
Pure, isomorphic (browser and Node). No `node:` imports.

1. **Enums / constants**: `Role` (`TRAFFIC`, `DATA`, `OPS`), `MatchPhase` (design: `LOBBY`, `BRIEFING`, `REPAIR_1`, `RUNS_1_2`, `INCIDENT_EVIDENCE`, `REPAIR_2`, `RUN_3`, `COMPARE`, `FINISHED`), `RunNumber` (1 | 2 | 3), `Outcome` codes (`ACCEPTED`, `ALREADY_USED`, `TIMEOUT`, `PENDING_NOT_CONFIRMED`, `QUEUE_FULL`, `APP_OVER_CAPACITY`, `RETRY`).
2. **Configuration choices** (design 5): zod enums `AppCapacity` and `DbCapacity` (`LOW|MEDIUM|HIGH`), `atomicCheckin` boolean, `RetryPolicy` (`NO_RETRY | RETRY_SAME_KEY | RETRY_NEW_IDENTITY`), `cache` boolean (`CacheMode`: `OFF | ON_READS_ONLY`; cache as authority is representable only so the simulator can reject it: `cacheAsAuthority` is **not** a player-exposed option).
3. **`ConfigurationValues`** schema (strict, unknown keys rejected).
4. **`AppError`** class: `{ code, httpStatus, safeMessage, cause? }` plus error code enum (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `PHASE_INVALID`, `LOCK_NOT_HELD`, `VERSION_CONFLICT`, `INTERNAL`).
5. **Canonical hashing**: `canonicalize(value)` (sorted keys, stable numbers, rejects `undefined`/`NaN`) and `contentHash(value)` using `@noble/hashes` sha256 (pure JS, keeps sim isomorphic).
6. **WS envelope schemas**: `{ v: 1, type, id, payload }` with discriminated unions for client→server and server→client events listed in architecture section 7. Payload schemas `.strict()`.
7. **DTOs**: public match view, member view, run summary view. Evidence DTO defined but flagged `private`.

### 2.2 `packages/scenario`
1. **Schema** `ScenarioConfigSchema` (zod, strict) covering:
   - `scenarioId`, `scenarioVersion`, `engineCompat` (engine versions allowed)
   - `deadlineSeconds`, `requiredValidAdmissions`, `totalPasses`
   - `timeoutMs` (gate timeout), `raceWindowMs`
   - `trafficSeries.normal[]` and `trafficSeries.incident[]` (attempts/s per second)
   - `tiers.app.{LOW,MEDIUM,HIGH}.{capacityRps, baseLatencyMs, cost}`; same for `db` (writes/s)
   - `cache.{cost, readLatencyMs, staleReadProbabilityRule}` (deterministic rule, not random)
   - `queue.{enabled, maxBacklog, workerRate, cost}`
   - `latency.{overloadStartUtil: 0.7, steepStartUtil: 0.9, linearPenaltyMs, steepPenaltyMs}`
   - `budgetLimit`, `budgetDisplayRange` (public range)
   - `gates[]`: ids, `connectivity` schedule per incident (offline windows, affected gates)
   - `retry.{retryAfterTimeoutRate}` per profile
   - `simultaneousScan.{enabled, passIds[], gateIds[]}` (deterministic race)
   - `presetConfiguration` (the deliberately flawed start)
   - `referenceRepair` (a known-passing configuration used by tests and tuning only; never shipped to clients)
2. **Data**: `data/campuspass.v1.json` with concrete starting values. Values are tunable in Step 04/10 but the *structure* is frozen here.
3. **Incident profiles**: `normal` and `incident` (arrival spike duration, retry-rate multiplier, outage window, stale-replica flag, committed-timeout set).
4. **Evidence definitions** (`evidence.ts` / JSON): per role, opening card and incident card, each a list of **unique fact IDs** (e.g. `peak_rps`, `retry_pct`, `db_write_cap`, `atomic_status`, `budget_total`, `outage_window`). Facts reference scenario fields so text is generated from config values, not hand-copied numbers.
5. **Loader**: `loadScenario(id, version)` returns validated, deep-frozen config plus `scenarioHash`.
6. **Public projection**: `toPublicScenario(config)` returns only public fields (design section 2): target, deadline, choices, budget range, preset. Hidden: exact traffic series, exact capacities, price breakdown, outage detail.

### 2.3 Documentation
- `packages/scenario/README.md`: unit table (attempts/s, writes/s, requests/s, ms, jobs, credits) and where each value is used.

---

## Unit tests required
**shared**
- `canonicalize`: key order independence, nested objects, arrays order-sensitive, rejects `undefined`/`NaN`/functions.
- `contentHash`: same value → same hash; any field change → different hash; golden hash for a fixed fixture.
- Config schema: accepts valid, rejects unknown keys, rejects bad enums.
- WS envelope: rejects missing `v`, unknown `type`, extra payload keys, oversized strings.
- `AppError`: serializes to safe message without `cause`.

**scenario**
- `campuspass.v1.json` parses with the schema.
- All capacities/costs positive; tiers monotonic (LOW < MEDIUM < HIGH in capacity and cost).
- `presetConfiguration` is valid and has: atomic OFF, retry `RETRY_NEW_IDENTITY`, app tier insufficient for incident peak (assert using config arithmetic only, no sim).
- `referenceRepair` valid and within `budgetLimit`.
- Traffic series length ≥ `deadlineSeconds` window; non-negative integers.
- **Evidence uniqueness**: no fact ID appears in two roles' opening cards; no fact ID repeats between a role's opening and incident cards; every fact resolves to a real config field.
- **Public projection leak test**: serialized public view contains none of the hidden keys/values (peak rps, tier capacities, outage window, cost table).
- Loader returns frozen object (mutation throws in strict mode); `scenarioHash` stable.

## Security checks
- [ ] Evidence content is generated server-side only; client bundle imports `toPublicScenario`, never the full config (verify via a lint boundary: `web` may import `scenario` public subpath only).
- [ ] `referenceRepair` not exported from the public entry point.
- [ ] WS schemas are `.strict()`; max string/array lengths set.
- [ ] No `node:` imports in `shared` (isomorphic check).

## Exit criteria
- `npm test` green with coverage ≥ 90% for `shared` and `scenario`.
- Every number the simulator will need exists in config; a grep for numeric literals in the (still empty) `sim` package finds none.
- Team can read the scenario README and explain each unit (design Step 1 exit test).
