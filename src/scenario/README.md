# CampusPass v1

`data/campuspass.v1.json` is the source of all game values. The loader validates
and freezes it; `public.ts` projects only public information.

| Value                                       | Unit                 | Used by                                      |
| ------------------------------------------- | -------------------- | -------------------------------------------- |
| Traffic series                              | Scan attempts/second | Traffic expansion                            |
| App tier capacity                           | Requests/second      | Admission request processing                 |
| DB tier capacity                            | Writes/second        | Authoritative check-in path                  |
| Base/overload latency, timeout, race window | Milliseconds         | Responses, retries, concurrent reads         |
| Queue capacity                              | Jobs                 | Backlog and overflow                         |
| Worker rate                                 | Jobs/second          | Queue drain                                  |
| Costs and budget                            | Credits/match        | Budget hard gate                             |
| Deadline, outage windows                    | Seconds              | Valid confirmation cutoff, fail-closed gates |
| Match timers and leases                     | Milliseconds         | Server phase timer and editor lease          |

The original LOW/LOW preset is intended to pass normal traffic but fail the
incident through a repeatable race and insufficient throughput. The private
reference repair passes the incident within budget. HIGH/HIGH exceeds budget.
Atomic OFF remains incorrect at high capacity. Atomic ON at LOW capacity still
misses the incident target.

The deterministic race starts at second zero, before retry work can monopolize
the application tier. This keeps the correctness demonstration observable even
when the flawed application tier rejects later overload. Reconnection submits
held scans with their original idempotency keys; local offline scans are never
admissions. Queueing never supplies atomicity.

Latency uses nearest-rank percentiles over completed and timed-out processed
requests. Immediate APP_OVER_CAPACITY rejections are separate observed outcomes.
Every traced second records gate-observed outcomes separately from committed DB
pass state. No source reads the wall clock or random generator.

`referenceRepair`, exact traffic, capacities, prices and outage details are
server-only. Evidence facts are rendered from actual config fields, with unique
fact IDs across roles. The public entry point never exports the reference repair.
