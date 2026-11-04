# ScaleSquad — Critical Design Revision (Version 2)

> This revision incorporates the six critical review points. It is the authoritative implementation direction for the MVP. Where the earlier blueprint conflicts with this revision, **this revision takes priority**. The key change is to build a small, testable game loop before adding voice, AI, a large canvas, or extra scenarios.

## Revised product definition

ScaleSquad is a cooperative incident-response game in which three players receive different private evidence, discuss it through Nexconn messaging, repair a deliberately flawed system configuration, and prove whether their repair works under the same failure conditions.

The MVP is not a free-form architecture drawing tool. It is a constrained systems game with:
- One scenario: CampusPass festival QR check-in.
- Three essential roles: Traffic, Data, and Operations/Reliability.
- A deliberately flawed preset architecture.
- A small set of meaningful configuration choices.
- A deterministic simulator with explicit correctness rules.
- An incident that reveals new private evidence.
- A fair before/after comparison using identical incident inputs.
- Nexconn group and private messaging as the core collaboration layer.

Voice and AI explanations are deferred until the core match is playable and understandable.

---

## 1. Simulator rules — define these before UI work

### 1.1 Simulation model and units

Use a discrete-time simulation with one-second steps. Each run receives an immutable input bundle:

- Scenario version.
- Architecture configuration version.
- Traffic profile.
- Incident profile.
- Retry policy.
- Simulation engine version.

The same input bundle must always produce the same output. Do not use random behavior in the first version. If randomness is introduced later, use a stored seed.

Use these units consistently:
- Traffic: incoming scan attempts per second (attempts/s).
- Database capacity: accepted write operations per second (writes/s).
- App capacity: requests processed per second (requests/s).
- Latency: milliseconds.
- Queue: pending jobs.
- Cost: credits per simulated match, not real currency.

The first version should use scenario-defined values in a configuration file. Do not scatter magic numbers throughout the code.

### 1.2 Pass state and atomic check-in

Each pass has one authoritative state:

`UNUSED → ACCEPTED`

There is no transition back to `UNUSED` during a match.

When **Atomic check-in = ON**, the database performs one indivisible operation equivalent to:

`accept(pass_id) only if pass_id is currently UNUSED`

Only one concurrent request can win. Any later request for the same pass receives `ALREADY_USED`. This is the only configuration that satisfies the strict single-use requirement in the MVP.

When **Atomic check-in = OFF**, the simulator models a non-atomic read-then-write sequence:
1. Request A reads `UNUSED`.
2. Request B reads `UNUSED` before A writes.
3. A writes `ACCEPTED` and reports success.
4. B writes `ACCEPTED` and also reports success.

If two requests overlap inside the configured race window, both may report success. The simulator records a duplicate admission. This is intentional: adding a database component does not automatically make the check-in operation safe. Correctness depends on the modeled operation and consistency behavior, not on the existence of a database box.

### 1.3 Two gates scan the same pass

Model two gate requests as separate attempts with the same `pass_id`.

**Atomic check-in ON**
- Both requests may reach the database.
- The first request to execute the atomic operation changes the pass to `ACCEPTED`.
- The second receives `ALREADY_USED`.
- Exactly one admission is counted.
- The second result is a valid rejection, not a system error.

**Atomic check-in OFF**
- If both requests read the pass before either write completes, both can receive a success response.
- The simulator increments `duplicateAdmissions` by one for the extra admission.
- The correctness gate fails even if latency and throughput are excellent.

The simulator should create a deterministic overlap when the scenario's simultaneous-scan test is enabled. This makes the race reproducible rather than dependent on runtime scheduling.

### 1.4 Timeout after the database has accepted the pass

This is a critical retry case.

1. The gate sends a check-in request.
2. The database commits `ACCEPTED`.
3. The response is lost or delayed beyond the gate timeout.
4. The gate sees `TIMEOUT`, not success.
5. The gate retries according to its configured retry policy.

The database state remains `ACCEPTED`; a timeout does not roll back a committed write.

**With idempotent retry handling**
- The retry carries the same idempotency key / request identity.
- The system recognizes that the original operation already succeeded.
- It returns the original outcome or `ALREADY_ACCEPTED_BY_THIS_REQUEST`.
- It must not create another admission.

**Without idempotent retry handling**
- A retry may be treated as a new operation.
- The system may return a confusing duplicate response or, if the non-atomic path is also enabled, create a duplicate admission.
- The simulator records the retry outcome and any duplicate separately.

For MVP simplicity, the Retry Policy control has three options:
- `No retry`
- `Retry once, same idempotency key`
- `Retry once, new request identity`

The second is the safe retry behavior. The third intentionally demonstrates why retry identity matters.

### 1.5 Queues

The queue is an optional buffering component, not a correctness mechanism.

- Requests enter the queue at the configured arrival rate.
- Workers remove and process requests up to their per-second capacity.
- If arrivals exceed worker capacity, backlog grows.
- Queue wait time contributes to end-to-end latency.
- If backlog exceeds the configured maximum, excess work is rejected as `QUEUE_FULL`.
- A queue does not make duplicate check-ins safe. The atomic check-in rule is still required.
- A queue may improve burst handling but can cause valid visitors to miss the deadline if processing is too slow.

For the first MVP, the queue can be represented by a simple backlog counter and worker throughput setting. It does not need a full message-broker implementation.

### 1.6 Disconnected gates

Each gate has a connectivity state: `ONLINE` or `OFFLINE`.

When online:
- It sends requests to the service.
- It receives success, already-used, retry, or error outcomes.

When offline:
- It cannot contact the authoritative service.
- It must not locally mark a pass as definitively accepted.
- It can hold a pending scan locally and show `PENDING — NOT CONFIRMED`.
- When connectivity returns, it submits the pending request using the original idempotency key.
- The server then decides whether the pass is still unused or was accepted by another gate.

MVP policy: disconnected gates fail closed for admission confirmation. A pending scan is not counted as a valid admission until the authoritative service confirms it. This protects the no-duplicates rule. The trade-off is that some visitors may wait or be denied during an outage; that is a visible availability consequence for the team to manage.

### 1.7 Capacity, latency, and cost

Each component has explicit scenario values.

**App capacity**
- `appCapacity` is the maximum requests the application tier can process per second.
- Requests above capacity wait if buffering is available; otherwise they fail with `APP_OVER_CAPACITY`.
- App utilization is `incomingAppRequests / appCapacity`.

**Database capacity**
- `dbWriteCapacity` is the maximum authoritative check-in writes per second.
- Requests above capacity wait if queued or fail/time out according to the scenario.
- Database utilization is `databaseWrites / dbWriteCapacity`.
- Atomic check-in is a separate correctness setting. Increasing database capacity does not enable atomicity.

**Latency**
- Each successful processing stage adds its configured base latency.
- Queue wait is added to end-to-end latency.
- Overload adds a deterministic penalty. For MVP, define a simple bounded rule in code and document it in the scenario config, for example:
  - At utilization up to 70%: no overload penalty.
  - Above 70% and up to 90%: add a linearly increasing penalty.
  - Above 90%: add a steep penalty and mark the component `SATURATED`.
- A request exceeding the gate timeout returns `TIMEOUT` to the gate, even if the database later commits. The final database state and the gate's observed response are tracked separately.

**Cost**
- Every enabled component/configuration has a per-match credit cost.
- Total cost is the sum of the enabled app capacity tier, database capacity tier, optional cache, and any queue/worker tier.
- The budget is a hard scenario limit.
- Adding capacity can improve throughput but may exceed budget.
- Adding a database does not automatically pass correctness.
- Cost is not inferred by AI; it is calculated from the scenario's fixed price table.

### 1.8 Required simulator output

Every run must return:
- `validAdmissions`
- `duplicateAdmissions`
- `rejectedAlreadyUsed`
- `pendingAdmissions`
- `timedOutRequests`
- `retriedRequests`
- `retrySuccesses`
- `queuePeak`
- `queueRejected`
- `appUtilizationPeak`
- `dbUtilizationPeak`
- `p50LatencyMs`
- `p95LatencyMs`
- `admissionDeadlineMet`
- `totalCost`
- `budgetMet`
- `correctnessPassed`
- `throughputPassed`
- `overallGatePassed`
- `failureReasons[]`

Each failure reason should identify the causal rule and evidence. Examples:
- `DUPLICATE_ADMISSION: pass P-104 was accepted by both Gate A and Gate B because atomic check-in was disabled.`
- `VALID_ADMISSION_TARGET_MISSED: 8,420 of 9,000 required valid admissions completed before the deadline.`
- `BUDGET_EXCEEDED: design cost 112 credits; scenario budget is 100 credits.`
- `QUEUE_OVERFLOW: backlog reached 1,250; queue limit is 1,000.`

No result screen should say only “Your system failed.” It must say what happened, why, and which configuration caused it.

---

## 2. Make every player necessary

The opening briefs must contain different, non-overlapping facts. Shared public information is shown to everyone; private evidence adds information that changes design decisions.

### Public scenario information

Everyone sees:
- CampusPass festival check-in.
- Each pass must be accepted once.
- The target number of valid admissions and deadline.
- The available configuration choices.
- The infrastructure budget range (but not necessarily the hidden cost breakdown).
- The initial flawed architecture.

### Private role information

**Traffic Engineer — load and retry evidence**
- Exact peak arrival rate.
- Shape and duration of the arrival spike.
- Percentage of users who retry after a timeout.
- How many requests can overlap during the peak.
- Which minute has the highest arrival rate.

This player is necessary to choose sufficient app capacity and a suitable retry policy.

**Data Engineer — correctness and write evidence**
- Database write capacity.
- Whether the current check-in operation is atomic.
- Which consistency options are available.
- The deterministic two-gate race test details.
- What happens when a retry arrives after a committed write.

This player is necessary to prevent duplicate admissions and reason about the authoritative write path.

**Operations Engineer — budget and outage evidence**
- Total budget and component price tiers.
- Which component is likely to degrade during the incident.
- Gate connectivity outage duration and affected percentage.
- Whether additional app/database capacity is affordable.
- Recovery constraints.

This player is necessary to balance reliability, capacity, and cost.

Do not duplicate these facts in another player's brief. Each role may receive a short role-specific hint, but the underlying evidence should be unique.

### New private evidence during the incident

The game must continue distributing private information after the opening round. When the incident starts, each player receives a new private evidence card:

- **Traffic incident evidence:** The retry rate has doubled, or the arrival spike will last longer than first forecast.
- **Data incident evidence:** The database has already committed a timed-out pass, or a replica is stale and cannot safely answer the authoritative check-in.
- **Operations incident evidence:** Two gates are offline for a defined interval, or the remaining budget cannot support the most expensive capacity upgrade.

The exact incident card should be generated from the selected incident configuration. Each card must reveal a distinct piece of evidence that matters to a repair decision.

Private evidence is delivered only to its assigned player using the supported Nexconn private-message path. The player chooses what to share. The game UI must not leak the contents into group chat automatically.

### Contribution design

A role is useful only if the match contains a decision that depends on its information:
- Traffic evidence affects capacity and retry choices.
- Data evidence affects atomicity and retry correctness.
- Operations evidence affects capacity tier, budget, and outage strategy.

For a three-player match, all three roles are required. Do not allow the match to start with a missing role.

---

## 3. Correctness is a hard pass/fail gate

A fast system that admits duplicate tickets must fail. A system that rejects everyone must also fail.

### Gate A — No duplicate admissions

`duplicateAdmissions == 0`

If this condition is false, the match fails the correctness gate regardless of speed, cost, or score.

### Gate B — Minimum valid admissions by deadline

`validAdmissions >= requiredValidAdmissions`

The scenario config defines `requiredValidAdmissions` and `admissionDeadlineSeconds`. A request counts only if:
- The authoritative service confirms the pass as accepted.
- The pass was not previously accepted.
- The confirmation arrives before the scenario's admission deadline.

Pending offline scans do not count until confirmed. Rejected duplicate scans do not count as valid admissions.

### Gate C — Budget

`totalCost <= budgetLimit`

Budget is a hard constraint for the scenario. If exceeded, the team may receive a partial performance score for learning purposes, but it cannot earn a successful match result.

### Overall pass

`overallGatePassed = (duplicateAdmissions == 0) AND (validAdmissions >= requiredValidAdmissions) AND (totalCost <= budgetLimit)`

The first two conditions are the non-negotiable correctness and throughput requirements. Budget is also a scenario constraint. Only after these gates are evaluated should the game compare latency, cost efficiency, and prediction accuracy.

### Scoring order

1. Evaluate correctness gate.
2. Evaluate valid-admission/deadline gate.
3. Evaluate budget gate.
4. If all hard gates pass, calculate performance score from latency, reliability, cost efficiency, and prediction accuracy.
5. If any hard gate fails, label the run `FAILED` and show the failed gates. A diagnostic score may still be shown, but it must never make a failed design look like a win.

---

## 4. Fair repair comparison: three required runs

Every match uses three runs with a fixed scenario and traffic profile.

| Run | Architecture | Conditions | Purpose |
|---|---|---|---|
| Run 1 | Original preset | Normal conditions | Establish baseline behavior |
| Run 2 | Same original preset | Incident conditions | Show the failure under stress |
| Run 3 | Repaired design | **Same incident and same traffic as Run 2** | Measure whether the repair helped |

The incident type, incident timing, arrival-rate series, gate outage window, retry pattern, and simulation engine version must be identical between Runs 2 and 3. Only the architecture/configuration choices may differ.

The comparison screen must show:
- Duplicate admissions: before vs after.
- Valid admissions by deadline: before vs after.
- P95 latency: before vs after.
- Peak queue backlog: before vs after.
- App/database peak utilization: before vs after.
- Cost: before vs after.
- Hard gates passed/failed: before vs after.

A repair is not automatically considered successful just because one metric improves. For example, lower latency with duplicate admissions remains a failed design. The UI should explicitly say which hard gates changed and which trade-offs were introduced.

Run 1 is diagnostic and educational. Runs 2 and 3 are the fair incident comparison.

---

## 5. Cut canvas scope: use a constrained repair panel

Do not build a free-form drag-and-drop architecture canvas for the MVP. Start with a flawed preset architecture and a handful of choices.

### Initial flawed preset

The initial design should intentionally have:
- Insufficient application capacity for the peak.
- Atomic check-in disabled.
- An unsafe retry policy (retry with a new request identity).
- No buffering for bursts.
- Optional cache disabled or configured with a misleading/stale-read behavior.

The preset must be flawed in explainable ways. It should not fail for hidden or arbitrary reasons.

### Player-controlled choices

1. **App capacity:** Low / Medium / High.
2. **Database capacity:** Low / Medium / High.
3. **Atomic check-in:** Enabled / Disabled.
4. **Retry policy:** No retry / Retry once with same idempotency key / Retry once with new request identity.
5. **Optional cache:** Off / On.

For MVP, the cache should only accelerate non-authoritative reads. It must never be used to decide whether a pass can be admitted. If the team configures a cache as the authority for single-use check-in, the simulator should fail that correctness check.

A queue can be a fixed feature in the preset or one explicit toggle only if time permits. Do not add it as another large editor surface. Its capacity and worker rate should be fixed by the scenario or selected through one simple control.

### One active editor and pass control

Only one player edits the configuration at a time.

- The current editor is clearly shown.
- Other players can view the current configuration.
- The editor can click **Pass control** to hand editing to another squad member.
- The backend records who owns the edit lock.
- The server validates every change.
- Every accepted change increments `configurationVersion`.
- If the editor disconnects, the host can reclaim control after a short timeout.
- Players can still discuss choices through Nexconn while one person edits.

### Simulation lock

When a simulation starts:
- Configuration becomes read-only.
- The server snapshots the configuration version.
- All three run inputs are recorded.
- The simulation uses the immutable snapshot.
- Editing is re-enabled only after the run completes.

This avoids mid-run changes and makes comparisons reproducible.

---

## 6. Prove the game is fun before polish

Run an early playtest with **three people who have not helped build the project**. Do not coach them during the match. Give them only the in-game instructions.

### Playtest procedure

1. Give the three players a join code.
2. Let them read their private opening briefs.
3. Observe whether they share the important information.
4. Let them choose a repair using the constrained controls.
5. Run the baseline and incident simulations.
6. Deliver the private incident evidence.
7. Let them discuss and make a second repair.
8. Run the same incident against the repaired configuration.
9. Ask them to explain the result in their own words.
10. Ask whether they would play another round.

### Record these observations

| Question | Evidence to collect |
|---|---|
| Did everyone contribute? | Did each role share at least one unique fact that affected a decision? |
| Did they understand why it failed? | Can each player name a failure cause without being told? |
| Did the repair change the result? | Did at least one relevant metric or hard gate change between Runs 2 and 3? |
| Was the information useful? | Did players use incident evidence to change a decision? |
| Was the game understandable? | Where did players pause, ask what to do, or misread a metric? |
| Do they want another round? | Ask directly after the match; record yes/no and why. |

### Minimum playtest success criteria

- All three players contribute at least one unique fact.
- The squad can identify the main failure cause without developer explanation.
- The repaired run uses the exact same incident and traffic as the original incident run.
- The repair produces a visible, explainable change.
- At least two of the three players say they would play another round.
- No developer intervention is needed to finish the match.

If these conditions are not met, improve the rules, brief design, or match flow before adding voice, AI, more components, or more scenarios.

---

## 7. Revised MVP build order

The required order is:

### Step 1 — Rules
Write and review the scenario configuration, pass state transitions, race condition, timeout/retry semantics, disconnected-gate behavior, capacity, latency, and cost rules. Agree on exact units and hard gates.

**Exit test:** The team can explain every modeled failure and its cause before a UI exists.

### Step 2 — Basic simulator
Build a command-line or test-driven simulation first. Implement the three-run comparison and deterministic outputs. Add tests for:
- Two gates scanning the same pass.
- Timeout after a committed database write.
- Same-key and new-key retries.
- Queue overload.
- Offline gate and later reconnection.
- App and database saturation.
- Budget overrun.
- Fast but incorrect design.
- Correct but too-slow design.

**Exit test:** Identical inputs always produce identical outputs, and every failed run has a machine-readable cause.

### Step 3 — Playable multiplayer loop
Build the lobby, three roles, private opening briefs, Nexconn group chat, incident private evidence, constrained repair controls, pass-control handoff, simulation lock, and three-run result comparison.

**Exit test:** Three players can complete a full match using messaging, without voice or AI.

### Step 4 — Playtest and tune
Run the three-new-player test. Fix confusing rules and weak role contributions. Tune scenario values so the original preset fails for understandable reasons and a thoughtful repair can pass.

**Exit test:** Players understand the failure and want another round.

### Step 5 — Polish
Only now add voice, AI explanations, visual charts, animation, additional incidents, and further scenarios. Voice remains a priority feature, but it must not delay proving the core game loop.

---

## 8. Revised data and event requirements

Add or ensure these records exist:

- `ScenarioConfig`: scenario version, traffic series, deadline, required valid admissions, budget, capacity tiers, cost table, outage profile.
- `GateScan`: gate ID, pass ID, request ID, idempotency key, sent time, commit time, response time, outcome.
- `PassRecord`: pass ID, authoritative state, accepted request ID, accepted gate ID.
- `SimulationRun`: run number, configuration version, incident version, traffic profile ID, engine version, result payload.
- `PrivateEvidence`: match ID, user ID, phase, evidence payload, delivered timestamp.
- `EditLock`: match ID, current editor ID, lock expiry, configuration version.
- `ConfigurationSnapshot`: immutable configuration used by each run.

Every run should store the full immutable input snapshot or a content-addressed reference to it. Do not compare results if the incident or traffic inputs differ.

---

## 9. Revised demo story

The demo should show the game mechanics, not a large canvas or an AI chatbot.

1. Three players join the squad.
2. Each receives a different private brief.
3. They share traffic, data, and budget constraints through Nexconn group chat.
4. They inspect the flawed preset.
5. One player edits; then passes control to another.
6. Run 1 shows normal baseline behavior.
7. Run 2 shows the same flawed design under an incident, including a concrete failure such as duplicate admissions or missed deadline.
8. Each player receives new private incident evidence.
9. The squad discusses the evidence and repairs the configuration.
10. Run 3 uses the exact same incident and traffic as Run 2.
11. The comparison shows whether the repair fixed correctness and throughput without breaking budget.
12. The players explain the result.

Voice and AI are optional demo enhancements only after this flow works reliably.

---

## 10. Updated acceptance checklist

- [ ] Scenario rules and units are written and versioned.
- [ ] Two-gate concurrent scan is deterministic.
- [ ] Timeout-after-commit behavior is modeled.
- [ ] Retry identity changes the modeled outcome correctly.
- [ ] Offline gates cannot falsely confirm admission.
- [ ] Queue backlog and overflow are modeled.
- [ ] App and database capacity affect throughput and latency.
- [ ] Cost is calculated from a fixed price table.
- [ ] Every failure includes a clear cause.
- [ ] Duplicate admissions are a hard fail.
- [ ] Minimum valid admissions by deadline are a hard fail.
- [ ] The initial architecture is intentionally flawed.
- [ ] Three roles receive unique, necessary opening evidence.
- [ ] Each role receives new private incident evidence.
- [ ] The repair controls are limited to the agreed choices.
- [ ] Only one player edits at a time.
- [ ] Pass control works and is server-authoritative.
- [ ] Configuration is locked during simulation.
- [ ] Run 1 is original design under normal conditions.
- [ ] Run 2 is original design under incident conditions.
- [ ] Run 3 is repaired design under the exact same incident and traffic as Run 2.
- [ ] Results compare Runs 2 and 3 directly.
- [ ] Three new players complete a match without developer help.
- [ ] All players contribute and understand the failure.
- [ ] At least two of three playtesters want another round.

---



---

# Earlier full blueprint (reference; superseded where it conflicts with Version 2)

# ScaleSquad --- Deep Product & Technical Design

**Tagline:** Build together. Predict failure. Survive the system.\
**Product:** A cooperative multiplayer system-design crisis game.\
**Core integration:** Nexconn Chat SDK for group messaging and private
briefs; Nexconn Call SDK for voice, subject to an early feasibility
test.

## 1. Executive summary

ScaleSquad is a multiplayer engineering simulation for teams of three or
four. Each player receives different private information about a
software-system challenge. The squad must share what they know, design
an architecture together, predict its behavior, run a deterministic
simulation, and respond to a surprise incident under time pressure.

The differentiator is not the architecture canvas alone. It is the
combination of **private information + real-time communication + shared
decisions + measurable simulation + crisis response**.

A match follows this loop:

1.  Form a squad.
2.  Give each player a different private brief.
3.  Discuss the combined requirements through Nexconn group chat and
    voice.
4.  Build a shared architecture.
5.  Lock a prediction.
6.  Run a load simulation.
7.  Reveal an incident and patch the design.
8.  Re-run the simulation.
9.  Review the outcome and learn from an evidence-based debrief.

Target match length: 12--18 minutes.

## 2. Problem and opportunity

System-design learning can be passive, individual, and disconnected from
consequences. People draw diagrams or read case studies but do not
always experience how decisions behave under load, failure, retries,
consistency requirements, or cost limits. Real engineering, however, is
collaborative: different people hold different pieces of information and
must make decisions together.

ScaleSquad makes those dynamics playable. A team can discover that a
design which looks reasonable fails under a traffic surge, or that a
fast design violates a correctness requirement.

## 3. Vision, goals, and non-goals

### Vision

Make distributed-systems learning feel like a cooperative strategy game
in which every player has a meaningful role and every design decision
has a consequence.

### Goals

-   Make Nexconn messaging essential to the gameplay.
-   Make voice a first-class priority for squad coordination.
-   Give players different, useful private information.
-   Support a shared architecture canvas.
-   Produce repeatable and explainable simulation results.
-   Teach through evidence-based feedback.
-   Deliver one polished scenario before expanding content.

### Non-goals for the MVP

-   A production-grade cloud simulator.
-   A full professional architecture IDE.
-   Dozens of scenarios or components.
-   Public matchmaking, tournaments, or complex progression.
-   AI-generated performance metrics.
-   Replacing Nexconn with a custom chat or voice system.

## 4. Target users

**Primary:** CS and software engineering students, junior developers,
hackathon teams, coding clubs, and developer communities.\
**Secondary:** educators running workshops and groups practicing
system-design interviews.

  User       Need
  ---------- ------------------------------------------------------------
  Player     Understand the challenge and contribute useful information
  Host       Start a session and keep the squad moving
  Learner    Understand why the design passed or failed
  Educator   Run a repeatable team exercise

## 5. Core design principles

1.  No player has the whole answer.
2.  Communication must change the quality of team decisions.
3.  The deterministic simulation is the referee; an LLM does not decide
    outcomes.
4.  Every result must be explainable.
5.  ScaleSquad's backend owns game state and architecture.
6.  Nexconn carries group conversation, private briefs, presence, and
    voice.
7.  The first match should be short, guided, and satisfying.

## 6. First scenario: CampusPass

### Premise

A college festival expects 10,000 visitors. Staff scan QR passes at
entrance gates. Each pass must be accepted only once. Arrivals happen in
a short burst, some gates have unreliable connectivity, and the college
has a limited infrastructure budget.

### Shared requirements

-   Handle a sharp burst of QR scans.
-   Never accept the same pass twice.
-   Respond quickly.
-   Handle timeouts and retries safely.
-   Tolerate temporary gate connectivity problems.
-   Stay within a budget.
-   Give staff clear accepted, rejected, or retry outcomes.

### Private role briefs

**Traffic Engineer** - Most visitors arrive within a 15-minute window. -
The first five minutes are the busiest. - Some visitors scan repeatedly
when responses are slow. - A smaller second wave follows the opening
ceremony.

**Data Engineer** - A pass can be accepted only once. - Concurrent scans
can arrive at different gates. - The authoritative check-in record must
prevent two successful accepts for one pass. - Correctness matters more
than a fast but incorrect response.

**Reliability Engineer** - Some gates have unstable connectivity. -
Requests may be retried after timeouts. - The system must distinguish a
retry from a new check-in. - A temporary database or network failure
must not silently mark a visitor as checked in.

**Operations Engineer** - The budget is constrained. - Unlimited server
scaling is not allowed. - The database is the most expensive
component. - The system should degrade clearly rather than fail
unpredictably.

For a three-player match, combine Reliability and Operations into one
brief. Exact numerical scenario values should be configured and tested
by the game team rather than improvised by the AI.

### Why this scenario creates interesting decisions

-   Caching can improve speed but should not become the authority for
    single-use check-ins.
-   Read replicas can improve reads but may return stale data.
-   Queues can absorb bursts but add delay.
-   Retries improve resilience but require idempotency.
-   More capacity can improve performance but costs more.
-   Strong correctness constraints can limit throughput.

## 7. Full match flow

### Phase 1 --- Lobby (1--2 minutes)

A host creates a squad and receives a join code. Other players join, see
the roster and presence, and mark themselves ready. ScaleSquad
associates a Nexconn group channel with the squad. Players can join the
voice room if supported.

### Phase 2 --- Private briefs (about 2 minutes)

The match service assigns roles and delivers each player's brief through
a private Nexconn channel or supported direct-message path. The brief
contains role, facts, risks, and a prompt to share relevant information.
Private content must never be placed in the group channel.

### Phase 3 --- Squad discussion (2--3 minutes)

Players share their facts in group chat and voice. Optional prompts ask
about peak traffic, duplicate scans, correctness, retry behavior, and
budget. Do not reward raw message count; reward whether critical
constraints were surfaced and considered.

### Phase 4 --- Architecture design (3--4 minutes)

The team builds a shared graph from a limited palette: - Load Balancer -
Application Server - Cache - Primary Database - Read Replica - Queue -
Worker

Players add, remove, connect, and configure components. The canvas is
owned by ScaleSquad's backend. Nexconn can announce proposals and
approvals, but chat messages are not the authoritative architecture
record.

### Phase 5 --- Prediction lock (about 1 minute)

The team records: - First likely bottleneck. - Expected latency band. -
Expected availability band. - Expected cost band. - Biggest concern.

The prediction is locked before the first simulation.

### Phase 6 --- Load simulation

The engine runs a scenario-defined traffic profile and displays requests
per second, success rate, P50/P95 latency, database utilization, cache
hit rate, queue backlog, and estimated cost. A modeled one-minute
traffic story can be calculated in seconds; it need not take one real
minute.

### Phase 7 --- Surprise incident (2--3 minutes)

Reveal one incident: - Traffic surge. - Primary database slowdown. -
Cache outage. - Gate network interruption. - Retry storm.

The squad gets a short response window to propose and apply changes. The
incident is shown in the game UI and announced in the Nexconn group
conversation.

### Phase 8 --- Re-simulation

Run the revised design against the incident profile and compare it with
the first result.

### Phase 9 --- Debrief (2--3 minutes)

Show passed and failed requirements, the first bottleneck, helpful and
harmful decisions, prediction accuracy, and one high-value improvement.
AI can explain the evidence, but cannot invent metrics.

## 8. Roles and architecture gameplay

Roles are information lenses, not permission boundaries. Every player
can participate in every design decision.

  -----------------------------------------------------------------------
  Role                    Information             Contribution
  ----------------------- ----------------------- -----------------------
  Traffic Engineer        Arrival rates, bursts,  Capacity and load
                          retries                 assumptions

  Data Engineer           Uniqueness,             Correctness and
                          consistency, data       database design
                          constraints             

  Reliability Engineer    Failure modes,          Recovery and resilience
                          connectivity            

  Operations Engineer     Budget and              Cost and operational
                          infrastructure limits   trade-offs
  -----------------------------------------------------------------------

Each architecture component should define: - Type and configuration. -
Capacity or throughput limit. - Latency contribution. - Cost. -
Input/output connections. - Failure behavior. - Scenario-specific
behavior.

The MVP should use a small, understandable model. Later components could
include API Gateway, Rate Limiter, Object Storage, CDN, Message Broker,
Circuit Breaker, and Multi-region Replica.

### Validation checks

-   Is there a valid path from client traffic to an application service?
-   Is there a valid path to authoritative storage?
-   Are required connections present?
-   Is the single-use operation protected by the modeled consistency
    rule?
-   Does the design exceed the budget?
-   Are components disconnected or unused?

Return warnings and explanations; do not silently repair a player's
design.

### Proposals and approvals

A player can propose a change with an author, change payload, reason,
optional expected benefit, and status (pending, approved, rejected,
expired). The squad approves or rejects it. The backend applies approved
changes and broadcasts a new architecture version. A simple majority or
host-confirmation rule is sufficient for the MVP.

## 9. Deterministic simulation engine

### Why deterministic

The same scenario, architecture, incident, and engine version should
produce the same result. This makes the game fair, testable, and
explainable. Never ask an LLM to decide latency, throughput, or error
rates.

### MVP model

Represent the architecture as a directed graph. Nodes are components and
edges are request or event flows. Each node has modeled capacity,
latency, cost, and failure behavior. The scenario supplies arrival rate,
request mix, and incident parameters.

For a component with incoming rate (`\lambda`{=tex}) and service
capacity (`\mu`{=tex}), utilization is:

\[ `\rho `{=tex}= `\frac{\lambda}{\mu}`{=tex} \]

As utilization approaches 1, modeled latency and instability should rise
sharply. Use a documented, bounded penalty function for the MVP; do not
present a simplified formula as a precise real-world queueing
prediction.

For a queue:

\[ B\_{next} = `\max`{=tex}(0, B\_{current} + A - W) \]

where (B) is backlog, (A) is new work, and (W) is completed work during
the modeled time step.

For cache hit ratio (h), a simple read-load estimate is:

\[ `\lambda`{=tex}*{db-read} = `\lambda`{=tex}*{read}(1-h) \]

A cache outage or cold-cache incident can reduce (h). These are teaching
abstractions and must be labeled as estimates.

### Simulation outputs

-   Requests per second.
-   Success and failure rate.
-   P50 and P95 latency.
-   Component utilization.
-   Cache hit rate.
-   Queue backlog and delay.
-   Estimated cost.
-   Passed/failed requirement checks.
-   First reported bottleneck.
-   Trace explaining how metrics were calculated.

A result payload could contain `runId`, `scenarioId`,
`architectureVersion`, `incidentId`, `engineVersion`, `metrics`,
`checks`, and `bottleneck`. Example values must be clearly marked
illustrative.

### Repeatability

Version scenario configurations and simulation rules. Store architecture
version, incident configuration, and result trace. If randomized
variants are added, use a fixed seed. Test missing connections, zero
capacity, overloaded components, and queue growth.

## 10. Nexconn integration --- a core product pillar

Nexconn is not merely a chat widget beside the game. It is the
communication infrastructure through which players combine private
information and coordinate decisions.

### Nexconn responsibilities

  -----------------------------------------------------------------------
  Capability                          ScaleSquad use
  ----------------------------------- -----------------------------------
  Group messaging                     Main squad conversation

  Direct/private messaging            Deliver each player's private brief

  Presence                            Show connected squad members

  Message history                     Help players catch up

  Custom/rich message types           Display game alerts, proposals,
                                      approvals, and results

  Voice calling                       Live coordination during design and
                                      incident response
  -----------------------------------------------------------------------

Use current official Nexconn documentation for exact SDK method names,
initialization, event contracts, permissions, and platform support. Do
not guess API names or assume feature availability.

### ScaleSquad backend responsibilities

-   Squad membership and roles.
-   Match phases and timers.
-   Private brief assignment.
-   Shared architecture graph.
-   Proposals and votes.
-   Simulation and scoring.
-   Scenario configuration and debrief evidence.

Nexconn is not the source of truth for the architecture or match
lifecycle. A message may announce a state change, but the ScaleSquad
backend persists and validates it.

### Group message flow

1.  Create squad in ScaleSquad.
2.  Create or associate a Nexconn group channel.
3.  Squad members join.
4.  Client listens for messages and relevant events.
5.  Players discuss requirements and decisions.
6.  ScaleSquad publishes structured game notifications.
7.  Game UI reflects authoritative backend state.

### Private brief flow

1.  Match service assigns roles.
2.  It identifies the supported private communication path for each
    player.
3.  It delivers the brief only to that player.
4.  The player reviews it in a private brief panel.
5.  The player chooses what to share with the squad.

Verify Nexconn direct-channel privacy and message-persistence behavior.
Never include private brief contents in public logs or client payloads
accessible to other players.

### Structured event messages

Where custom message types are supported, use event types such as: -
`match_started` - `brief_available` - `proposal_created` -
`proposal_approved` - `proposal_rejected` - `incident_started` -
`simulation_completed` - `match_finished`

Include match ID, event ID, timestamp, and only the minimum necessary
payload. Critical game-state transitions must also be persisted by
ScaleSquad.

### Voice priority and feasibility gate

Voice is a first-class priority alongside messaging. Desired
experience: - Join squad voice room. - Mute/unmute. - See call
participants. - See active-speaker indication if supported. - Leave
call. - Handle denied microphone permissions and device errors.

**Test Nexconn Call SDK on day one.** Confirm supported
browsers/devices, participant limits, permission flow, join/leave
reliability, and whether voice works alongside the game UI. Do not
assume method names or limits. Build a tiny call proof-of-concept before
designing the full experience. If voice is blocked, keep the messaging
path robust and make the limitation explicit; check hackathon rules
before substituting another provider.

## 11. Technical architecture

``` text
                 +---------------------------+
                 |     ScaleSquad Client     |
                 | Lobby / Canvas / Results  |
                 +-------------+-------------+
                               |
                        HTTPS / Realtime
                               |
                 +-------------v-------------+
                 |       ScaleSquad API      |
                 | Auth / Squad / Match      |
                 +------+-------------+------+
                        |             |
             +----------v--+     +----v----------------+
             | Game State  |     | Deterministic       |
             | & Graph     |     | Simulation Engine   |
             +------+------+\    +----------+----------+
                    |       \               |
                    +--------v--------------v
                       Persistent Database

       +-----------------------------------------------+
       | Nexconn: Group Chat / Direct Messages /       |
       | Presence / Voice                              |
       +-----------------------------------------------+

       +-----------------------------------------------+
       | AI Debrief: explains structured engine output |
       +-----------------------------------------------+
```

### Service boundaries

**Client:** lobby, chat/voice UI, canvas, predictions, charts, incident
controls, results.

**API and match service:** squad creation/join, permissions, roles,
lifecycle, timers, briefs.

**Architecture service:** graph nodes/edges, validation, versioning,
proposals, updates.

**Simulation service:** scenario loading, deterministic calculations,
checks, traces, result persistence.

**AI debrief service:** plain-language explanation and learning
suggestions based only on supplied evidence.

**Nexconn integration module:** SDK initialization, group/direct
channels, presence, message events, voice.

The ScaleSquad backend is authoritative for match phase, timer,
architecture version, proposals, and simulation. Use WebSocket or an
equivalent real-time transport for game-state updates. Treat Nexconn
message events and ScaleSquad game-state events as separate streams.

## 12. Data model

Suggested entities:

-   **User:** `id`, `display_name`, `created_at`
-   **Squad:** `id`, `name`, `join_code`, `host_user_id`, `status`,
    `created_at`
-   **SquadMember:** `id`, `squad_id`, `user_id`, `role`, `joined_at`,
    `ready_state`
-   **Match:** `id`, `squad_id`, `scenario_id`, `scenario_version`,
    `status`, `phase`, `started_at`, `ended_at`
-   **PrivateBrief:** `id`, `match_id`, `user_id`, `role`,
    `brief_payload`, `delivered_at`
-   **ArchitectureVersion:** `id`, `match_id`, `version_number`,
    `graph_payload`, `created_by`, `created_at`
-   **Proposal:** `id`, `match_id`, `author_user_id`, `change_payload`,
    `reason`, `status`, `created_at`, `decided_at`
-   **Prediction:** `id`, `match_id`, `submitted_by`,
    `prediction_payload`, `locked_at`
-   **SimulationRun:** `id`, `match_id`, `architecture_version`,
    `incident_id`, `engine_version`, `result_payload`, `created_at`
-   **MatchScore:** `id`, `match_id`, `score_payload`, `created_at`
-   **NexconnMapping:** `id`, `squad_id`, `group_channel_reference`,
    optional `voice_room_reference`

Store only the Nexconn references and metadata needed by the app. Do not
expose credentials or access tokens in client-visible records.

## 13. Scoring

Suggested 100-point model:

  ------------------------------------------------------------------------
  Category                                    Points Measurement
  --------------------- ---------------------------- ---------------------
  Correctness                                     25 Single-use acceptance
                                                     and critical
                                                     requirements

  Reliability                                     20 Incident behavior and
                                                     recovery

  Performance                                     15 Latency and
                                                     throughput against
                                                     targets

  Cost efficiency                                 15 Meets requirements
                                                     within budget

  Prediction accuracy                             10 Prediction compared
                                                     with measured model
                                                     result

  Team process                                    15 Constraints shared,
                                                     risks considered,
                                                     decisions made
  ------------------------------------------------------------------------

Do not score raw message volume, word count, or call duration. Better
teamwork signals include whether critical constraints were shared before
prediction lock, whether risks were acknowledged, whether the team
responded to simulation evidence, and whether decisions were made before
the timer expired. Explain score changes transparently.

## 14. AI debrief design

### Allowed tasks

-   Explain metrics and failed checks.
-   Summarize important decisions for a returning or late-joining
    player.
-   Explain concepts such as idempotency, cache staleness, queue
    backlog, and bottlenecks.
-   Suggest one or two improvements grounded in the match.

### Input

Scenario requirements, architecture summary, actual simulation metrics,
passed/failed checks, incident, team prediction, and recorded decisions.

### Guardrails

-   Never invent or alter metrics.
-   Never override the deterministic score.
-   Distinguish observed results from possible explanations.
-   Admit when evidence is insufficient.
-   Do not reveal private briefs to other players unless the owner
    shared them.
-   Provide a template-based debrief if the AI service is unavailable.

Example: "The primary database reached 94% modeled utilization during
the traffic surge. The simulation identified it as the first bottleneck.
The cache reduced modeled read traffic, but check-in writes still
depended on the primary database. Consider controlled retries and
reviewing modeled write capacity." The numbers are illustrative; a real
debrief must use the current match result.

## 15. Screen and UX inventory

1.  **Home:** Create squad, join squad, how to play, previous match.
2.  **Lobby:** Join code, roster, presence, ready state, scenario, chat,
    voice.
3.  **Private brief:** Role, facts, risks, private indicator, ready
    action.
4.  **Squad workspace:** Canvas, component palette, chat, voice
    controls, presence, timer.
5.  **Prediction:** Bottleneck, latency, availability, cost, confidence,
    lock action.
6.  **Simulation results:** Metric cards, charts, utilization,
    passed/failed checks.
7.  **Incident response:** Incident banner, countdown, canvas,
    proposals, chat/voice, re-run.
8.  **Final debrief:** Score, before/after metrics, prediction
    comparison, decision timeline, AI explanation, play again.

Keep chat and voice accessible without obscuring the canvas. Make the
active phase and timer obvious.

## 16. MVP priorities

### P0 --- Must work

-   Squad creation and join code.
-   Three-player support; four if feasible.
-   Nexconn group messaging.
-   Nexconn private briefs.
-   Presence if supported.
-   Nexconn voice proof-of-concept and working call flow if feasible.
-   One CampusPass scenario.
-   Shared canvas with seven components.
-   Server-side graph validation.
-   One deterministic load simulation.
-   One incident type.
-   Re-simulation and result comparison.
-   Evidence-based passed/failed checks.

### P1 --- Strong additions

-   Proposal and approval cards.
-   More incident variants.
-   AI debrief.
-   Team decision timeline.
-   Better charts and simulation trace.
-   Late-joiner summary.

### P2 --- Later

-   More scenarios.
-   Public matchmaking.
-   Leaderboards and tournaments.
-   Scenario editor.
-   Educator dashboard.
-   Player progression.
-   More advanced simulation models.

**Scope rule:** A complete match with working communication is more
valuable than many unfinished features.

## 17. Implementation plan

### Stage 1 --- Feasibility

Read current Nexconn Chat and Call documentation. Build tiny group-chat,
private-message, and voice prototypes. Confirm permissions, browser
support, participant limits, and reliability. Choose the stack.

**Exit condition:** Two clients can exchange group messages, private
briefs reach only the intended player, and voice feasibility is known.

### Stage 2 --- Match foundation

Build identity, squads, join codes, roles, match lifecycle, Nexconn
channel mapping, private brief delivery, lobby, and presence.

**Exit condition:** A squad can start a match and each player sees only
their own brief.

### Stage 3 --- Shared design

Build graph editor, component palette, connections, server validation,
architecture versioning, real-time updates, and proposals.

**Exit condition:** Multiple players see the same architecture and
concurrent edits cannot silently overwrite one another.

### Stage 4 --- Simulation

Encode CampusPass configuration, deterministic capacity/latency rules,
one incident, result traces, and result UI.

**Exit condition:** Identical inputs produce identical outputs.

### Stage 5 --- Incident and voice

Integrate supported Nexconn voice, incident timer, event messages,
time-limited changes, and re-simulation.

**Exit condition:** Players coordinate during the incident through
messaging and, where supported, voice.

### Stage 6 --- Debrief and polish

Add grounded AI debrief or template fallback, score breakdown,
onboarding, error states, playtests, and demo backup recording.

## 18. Suggested hackathon team split

  Builder                Ownership
  ---------------------- --------------------------------------
  Frontend / game UX     Lobby, canvas, match screens, charts
  Backend / game state   Squads, roles, phases, persistence
  Nexconn integration    Group chat, DMs, presence, voice
  Simulation / AI        Scenario rules, engine, debrief

For a smaller team, combine backend and simulation and keep the UI
focused.

## 19. Demo script (3--5 minutes)

1.  Create a squad and show three players joining.
2.  Show that each player receives a different private brief.
3.  Have each player share one important fact in group chat.
4.  Join the Nexconn voice room and demonstrate the call.
5.  Build a simple architecture together.
6.  Lock the team's prediction.
7.  Run the simulation and show a bottleneck or failed check.
8.  Trigger the incident.
9.  Propose and approve one change.
10. Re-run the simulation.
11. Compare before/after metrics and show the evidence-based debrief.

The audience should see that communication is how players combine
private information and coordinate their response---not an unrelated
chat panel.

## 20. Testing plan

### Functional

-   Squad create/join and invalid code handling.
-   Role assignment and private brief isolation.
-   Group messages delivered to correct members.
-   Voice join/leave and permission failures.
-   Shared architecture synchronization.
-   Server validation of graph changes.
-   Prediction lock and phase transitions.
-   Incident timer and re-simulation.
-   Result persistence and display.

### Simulation

-   Same inputs produce same output.
-   Missing paths and zero capacity are handled.
-   Overload creates a bottleneck.
-   Queue backlog grows when arrivals exceed processing.
-   Cache outage changes modeled database read load.
-   Single-use check-in rule is enforced.
-   Budget checks are consistent.

### Privacy and security

-   A player cannot retrieve another player's private brief.
-   Only squad members access the match.
-   Only authorized users make changes.
-   Critical actions are validated server-side.
-   Join codes expire or become invalid after use where appropriate.
-   Nexconn credentials are not exposed.
-   AI receives only information appropriate to the match.

### UX

-   A first-time player understands the next action.
-   Private briefs are easy to find.
-   Chat does not cover essential canvas controls.
-   Incident state is visually clear.
-   Result explanations use plain language.
-   Reconnection does not corrupt match state.

## 21. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Voice integration takes too long    Test on day one; prioritize robust
                                      messaging fallback

  Simulation scope explodes           Use a small documented
                                      deterministic model

  Nexconn feels bolted on             Make private briefs and team
                                      coordination essential

  Too many features                   Ship one scenario and seven
                                      components

  AI invents outcomes                 AI only explains structured engine
                                      results

  Private brief leaks                 Enforce server-side authorization
                                      and test it

  Concurrent edits conflict           Server-authoritative versioning and
                                      proposals

  Players feel lost                   Guided match, phase prompts, and
                                      clear objectives
  -----------------------------------------------------------------------

## 22. Success measures

For the hackathon MVP, evaluate: - Can a new squad complete a match
without developer help? - Do players share private constraints before
prediction lock? - Does every player make a meaningful contribution? -
Can the team explain why its first design failed? - Does the incident
force a real team decision? - Does the second simulation show a
measurable change? - Does Nexconn messaging work reliably? - Can the
voice flow be demonstrated, or are its limitations clearly understood?

Do not claim proven educational impact from one demo; validate learning
outcomes with repeated playtests.

## 23. Differentiation

ScaleSquad combines: 1. **Information asymmetry:** each player knows
something different. 2. **Real communication:** the squad uses chat and
voice to combine knowledge. 3. **Shared architecture:** players design
one system together. 4. **Consequences:** deterministic simulation
exposes bottlenecks and failed requirements. 5. **Crisis response:** a
surprise incident forces adaptation under pressure.

A diagramming tool helps people draw. A chat app helps people talk. A
quiz tests individual knowledge. ScaleSquad connects these into one
cooperative engineering game.

## 24. Short pitch

**ScaleSquad is a multiplayer system-design crisis game where every
player holds a different piece of the puzzle. Teams use Nexconn
messaging and voice to share private constraints, build a shared
software architecture, predict how it will perform, and survive a
surprise production incident. A deterministic simulation reveals what
actually breaks, and an evidence-based debrief turns the match into a
learning experience.**

**Build together. Predict failure. Survive the system.**

## Appendix A --- MVP acceptance checklist

-   [ ] Host can create a squad.
-   [ ] Players can join with a code.
-   [ ] A three-player match can start.
-   [ ] Each player receives a different private brief.
-   [ ] Nexconn group messaging works.
-   [ ] Nexconn private messaging works for briefs.
-   [ ] Presence is shown if supported.
-   [ ] Nexconn voice is tested and constraints are known.
-   [ ] Team can build a shared architecture.
-   [ ] Architecture changes are server-validated.
-   [ ] Team can lock a prediction.
-   [ ] Simulation produces deterministic metrics.
-   [ ] One incident can be triggered.
-   [ ] Team can change the design during the incident.
-   [ ] Second simulation can be compared with the first.
-   [ ] Results explain passed and failed checks.
-   [ ] AI explanations are grounded, with a fallback.
-   [ ] Full demo works from a clean session.

## Appendix B --- Decisions to confirm before coding

1.  Which frontend and backend stack will be used?
2.  Which Nexconn Chat SDK platform and integration path will be used?
3.  Does the available Nexconn Call SDK support the intended group call?
4.  What is the exact match duration?
5.  Which incident will be shown in the live demo?
6.  Which scenario values and simulation formulas are fixed for version
    1?
7.  Will architecture edits be direct or proposal-based? Proposal-based
    is recommended for important changes.
8.  Which AI provider, if any, will power the debrief?

**Final recommendation:** Freeze the first scenario, component palette,
and simulation rules early. Build the complete match loop before adding
more content.
