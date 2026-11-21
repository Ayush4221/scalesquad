# Cloud Blackout — incident-learning scenario design

Status: designed learning scenario; not yet a new playable simulator mission.

## Real-world trigger

Microsoft 365 services experienced a widespread disruption beginning 12 November 2026. George Mason University's incident notice documents interrupted Outlook
access, delayed mail and partial failures in dependent applications. It also
distinguishes affected Teams features from basic messaging that remained usable.
Source: [GMU service notice](https://its.gmu.edu/alerts/unplanned-outages/).
Microsoft's [public status page](https://status.cloud.microsoft/) is the primary
place to check current provider information.

Do not assert a root cause, exact global impact, or a universal recovery time
without Microsoft's published incident review. Do not confuse this event with
the separate July 2024 CrowdStrike update incident.

## Fictional learning exercise

Three students operate a fictional campus collaboration service. Users cannot
open inboxes; some work remains queued, and a shared dependency is unavailable.
The scenario is inspired by the observed user impact, not a reconstruction of
Microsoft infrastructure, private telemetry or remediation.

The objective is to restore useful service without losing accepted work,
creating duplicate operations, or overloading the recovering dependency.

| Player     | Private evidence                                          | Essential chat contribution                           |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Traffic    | Failed requests, retry volume, backlog age                | Separate original demand from amplified retries       |
| Data       | Accepted work, operation identities, confirmation gaps    | Distinguish an unconfirmed response from a lost write |
| Operations | Dependency health, remaining capacity, restoration limits | Propose a safe recovery order and capacity ceiling    |

## Playable progression

1. Establish a healthy baseline; record accepted work and latency.
2. Lose the shared dependency; expose different evidence to each role.
3. Use Nexconn chat to agree on an incident hypothesis and a repair owner.
4. Select bounded retries with backoff, stable operation IDs, admission control,
   and gradual restoration. Increasing capacity alone must not cure an unavailable dependency.
5. Re-run the identical incident and demand trace.
6. Compare preserved work, duplicate operations, backlog drain time, recovery
   time, tail latency and cost. Ask each player which clue changed the plan.

These controls and recovery metrics require an explicitly versioned simulator
extension. The current simulator models festival check-ins, capacities, retries,
cache and atomic admission; it does not model Microsoft mail, regional failover,
deployment rollback or circuit breakers. New mechanics must not be implied by
renaming current UI labels or changing immutable scenario definitions.

## Video treatment now

Use the Microsoft disruption as the students' reason to practise. Show the
existing check-in game honestly as a smaller exercise in evidence sharing,
correctness and trade-offs. State that the recorded match is CampusPass, not a
Microsoft outage reproduction. Make Nexconn chat the visible bridge from
private observations to shared decisions, across web, phone and tablet views.

## Acceptance criteria for a future implementation

- Versioned, deterministic dependency outage and recovery schedule.
- At least one repair succeeds; capacity-only and unlimited-retry strategies fail.
- Same-input comparisons; no client-provided outcomes or hidden reference repair.
- Per-role evidence remains private until a player chooses what to share.
- Nexconn carries discussion; the authoritative game server owns all decisions.
- Test restoration, message reconnect, duplicate submission and mid-run disconnection.
