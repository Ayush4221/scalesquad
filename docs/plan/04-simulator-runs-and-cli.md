# Step 04 — Simulator Runs, Hard Gates, Three-Run Comparison, CLI

**Goal:** wrap the core rules into `runSimulation`, evaluate hard gates with machine-readable failure reasons, implement the fair three-run comparison, and ship a CLI. This is design doc Step 2 exit: identical inputs always give identical outputs, and every failed run has a machine-readable cause.

**Prerequisites:** Step 03 complete.

---

## Tasks

### 4.1 `runSimulation(bundle)`
- Validate bundle with zod. Compute `inputHash = contentHash(bundle)`.
- Execute steps from 0 to `deadlineSeconds + grace`.
- Return `SimulationResult` containing every field from design 1.8:
  `validAdmissions, duplicateAdmissions, rejectedAlreadyUsed, pendingAdmissions, timedOutRequests, retriedRequests, retrySuccesses, queuePeak, queueRejected, appUtilizationPeak, dbUtilizationPeak, p50LatencyMs, p95LatencyMs, admissionDeadlineMet, totalCost, budgetMet, correctnessPassed, throughputPassed, overallGatePassed, failureReasons[]`
  plus `inputHash`, `engineVersion`, `scenarioVersion`.
- `engineVersion` is a constant in code, bumped on any rule change; included in the hash so results never silently change.

### 4.2 Hard gates (design section 3)
- **Gate A** `duplicateAdmissions == 0`.
- **Gate B** `validAdmissions >= requiredValidAdmissions` counting only confirmations before the deadline.
- **Gate C** `totalCost <= budgetLimit`.
- `overallGatePassed = A && B && C`.
- Pending offline scans and `ALREADY_USED` rejections never count as valid.
- Status label `PASSED` / `FAILED`; a diagnostic score may exist only when all gates pass, or is labeled diagnostic-only when failed and can never produce a "win" state.

### 4.3 Failure reasons
Typed objects, not strings:

```ts
type FailureReason = {
  code: 'DUPLICATE_ADMISSION' | 'VALID_ADMISSION_TARGET_MISSED' | 'BUDGET_EXCEEDED'
      | 'QUEUE_OVERFLOW' | 'APP_SATURATED' | 'DB_SATURATED' | 'CACHE_USED_AS_AUTHORITY'
      | 'RETRY_IDENTITY_UNSAFE' | 'GATE_OUTAGE_UNCONFIRMED';
  rule: string;            // e.g. "atomicCheckin=false"
  evidence: Record<string, number | string>;  // counts, pass ids, utilization
  causedBy: string[];      // configuration keys responsible
  message: string;         // templated, built from evidence only
}
```

- Messages built from templates and evidence (design 1.8 examples). No result says only "failed".
- Ordering deterministic: sorted by severity then code.

### 4.4 Three-run orchestration (design section 4)
- `runMatchSimulations({ presetConfig, repairedConfig, scenario })`:
  - Run 1: preset, **normal** incident profile.
  - Run 2: preset, **incident** profile.
  - Run 3: repaired, **same incident profile and traffic series** as Run 2.
- Assert before Run 3: incident id/version, traffic profile id, outage window, retry pattern, engine version are identical to Run 2. Mismatch throws `COMPARISON_INPUT_MISMATCH`.
- `compareRuns(run2, run3)` returns per-metric before/after, plus `gatesChanged` (which gates flipped) and `tradeoffs` (for example latency better but cost worse). Never declares success on one improved metric when a hard gate still fails.

### 4.5 Tuning harness
- Test helper loads scenario and checks:
  - Preset **fails** Run 2 for explainable reasons (at least duplicates and capacity).
  - `referenceRepair` **passes** Run 3.
  - A "fast but incorrect" design (high capacity, atomic OFF) fails Gate A.
  - A "correct but too slow" design (atomic ON, LOW capacity) fails Gate B.
  - An "everything maxed" design fails Gate C (budget).
  - Run 1 normal conditions on preset passes or fails as scenario intends (documented in scenario README).
- If these assertions fail after value changes, tune scenario JSON only, never sim logic (record tuning decisions in `packages/scenario/README.md`).

### 4.6 CLI (`packages/sim/cli`)
- `npm run sim -- --scenario campuspass --repair <file|reference>` prints a table for Runs 1–3 plus the Run 2 vs Run 3 comparison and failure reasons.
- Flags: `--json` (machine output), `--config <file>` (custom preset), `--verbose` (per-second trace).
- Exit code `0` when Run 3 passes all gates, `1` otherwise (usable in CI).
- CLI is the only place `console` is allowed in sim; it lives outside the pure `src/` tree.

---

## Unit tests required

**Result shape**
- Result contains every required field with correct types (schema test).
- `inputHash` identical for identical bundle; differs if any field changes (including `engineVersion`).

**Determinism**
- Run each of the 3 runs 100 times → deep-equal results and equal hashes.
- Key order in input does not change output.

**Gates**
- Table-driven: all 8 combinations of gate A/B/C pass/fail → correct `overallGatePassed` and reason codes.
- Duplicate admissions with excellent latency → still `FAILED`.
- Zero rejections-of-everyone case (everything rejected) → fails Gate B.
- Budget exactly at limit passes; +1 credit fails.
- Pending-at-deadline excluded from valid count.

**Failure reasons**
- Every failed gate produces ≥ 1 reason with code, rule, evidence, causedBy.
- Reason messages contain only values present in evidence (no invented numbers).
- Examples from design 1.8 reproduced by test fixtures (duplicate pass id, target missed counts, budget, queue overflow).
- Ordering stable.

**Comparison**
- Run 2 and Run 3 inputs identical except configuration → comparison allowed.
- Any change in incident, traffic, outage, retry pattern, or engine version → throws `COMPARISON_INPUT_MISMATCH`.
- Lower latency with duplicates remaining → comparison flags correctness gate still failed.
- Repair that fixes gates A and B but breaks budget → `gatesChanged` shows trade-off, overall still `FAILED`.

**Tuning harness**
- Preset fails Run 2 with at least two distinct explainable reason codes.
- `referenceRepair` passes Run 3.
- Fast-but-incorrect, correct-but-slow, and over-budget fixtures behave as listed.

**CLI**
- `--json` output validates against schema.
- Exit code mapping tested through a spawned process (or by calling `main(argv)` with injected IO).
- Unknown flags rejected with message.

## Security checks
- [ ] CLI reads files only from explicit paths; validates JSON with zod; no code execution from config.
- [ ] CLI never prints evidence or hidden values beyond scenario internals (it is a dev tool; document that it must not ship in the web bundle: `web` cannot import `sim`).
- [ ] Result objects contain no PII (none present in sim).

## Exit criteria
- Determinism test passes (100 repeats).
- `npm run sim -- --scenario campuspass --repair reference` prints Run 1–3 and comparison; exit 0.
- Preset fails Run 2 for explainable reasons; reference repair passes Run 3.
- `packages/sim` coverage 100% on rule code, ≥ 95% overall.
- **Design Step 2 exit test met.** Do not start step 05 until the simulation behaviour is agreed by the team.
