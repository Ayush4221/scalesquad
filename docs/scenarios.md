# Research-inspired missions

Owner request, 2026-11-06: expand the playable scenario catalog using real-world
engineering writing. CampusPass remains the default and old matches keep it.

These are fictional festival check-in exercises inspired by failure patterns.
They are not replicas of the companies' systems, claims of endorsement, payment
simulators, or simulations of database leader election. All loads, budgets,
timing and admission targets below are game design values, not reported facts.
The existing deterministic simulator, three roles and three-run comparison stay.

| Mission     | Player problem                                          | Incident settings                                                                                               | Passing reference configuration                                     |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| CampusPass  | Original combined challenge                             | Existing v1 unchanged                                                                                           | Existing v1 unchanged                                               |
| Retry Storm | Confirm a committed check-in after the response is lost | 40 forced committed-response losses; 85 attempts/s burst; no disconnected gates; 3,000 target; 85-credit budget | Medium app/database; atomic writes; same-key retry; cache off       |
| Split Gates | Recover pending scans after a connection failure        | A/B/C disconnected at seconds 10–30; stale reads; 70 attempts/s peak; 2,600 target; 110-credit budget           | High app, medium database; atomic writes; same-key retry; cache off |
| Flash Crowd | Handle a burst without exceeding budget                 | 220 attempts/s for 15 seconds; all gates connected; 3,800 target; 135-credit budget                             | High app/database; atomic writes; same-key retry; cache off         |

All missions retain a reproducible simultaneous-pass race. Targets are confirmed
unique admissions before the deadline, with no duplicates and cost within budget.
Preset normal traffic must pass, preset incident traffic must fail, and a tested
repair must pass the identical incident. Reference repairs stay server-side.

## Sources and adaptation limits

- [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency).
  A network failure can leave the client unsure whether a write completed. This
  motivates Retry Storm's committed-write/lost-response case. The game uses
  admission confirmations, not financial transactions. No money is simulated.
- [GitHub — October 21 post-incident analysis](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/).
  A network partition led to database recovery work. Split Gates borrows only the
  connectivity/recovery tradeoff. It does not reproduce GitHub's replication,
  failover, topology or incident timeline.
- [Shopify — Surviving Flashes of High-Write Traffic, Part I](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i).
  Write-heavy bursts motivate Flash Crowd's capacity challenge. Shopify's traffic
  management implementation is not recreated; this game uses its existing app
  and database capacity controls.

Medium articles were also searched during research, including the Shopify
platform-engineering interview roundup by Horovits. The playable rules above
are grounded in the linked first-party engineering articles. The source lessons
are paraphrased; no article text or production metrics are copied into missions.

## Versioning and implementation

The catalog has four allowlisted IDs. Each full definition is a validated,
immutable `src/scenario/data/*.v1.json` file. Version 1 CampusPass is unchanged.
Never change a released definition in place: add a version and retain old data
so saved matches and run hashes remain reproducible.

`src/constants/scenarios.ts` contains only public descriptions and source links.
The dashboard imports it directly, never the server-side scenario registry.
Hosts choose a mission before creating; joiners inherit the stored selection.
`CreateMatchSchema` accepts only a known scenario ID and defaults empty legacy
requests to CampusPass. Clients cannot supply a version, custom rules or repair.
Match storage now retains both ID and version; evidence, run snapshots, phase
windows and edit leases resolve that pair. No new endpoint or library is needed.

Migration `20261106000000_match_scenario` adds a defaulted column, preserving
existing matches. Run `npm run db:migrate` before starting the updated server.
The migration is tested against the isolated E2E database, not the personal DB.

All tests remain under root `tests/`: catalog determinism, solvability, public
projection, cross-mission comparison rejection, controller validation, private
evidence, full service lifecycle and browser selection/persistence/joining.

## Verification (2026-11-06)

Production build, strict typecheck and lint/format checks passed. All 396 unit
and service tests passed. All 18 browser checks passed across desktop Chrome,
Android and iPhone, covering scenario selection, database persistence, joining,
dashboard validation and the existing full match loop. Desktop and mobile
screenshots were inspected. Built browser chunks contain neither reference
repairs nor committed-timeout scenario arrays. No personal database migration
was run; apply the included migration before launching against that database.

Additional research reviewed:
[Horovits — Scaling Platform Engineering: Shopify's Blueprint (Medium)](https://horovits.medium.com/scaling-platform-engineering-shopifys-blueprint-f18e97140681).
