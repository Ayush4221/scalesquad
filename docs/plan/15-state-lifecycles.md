# State lifecycle remediation plan

Scope: the 73 families in IMPLICIT_STATE_MACHINES.md. They are an inventory, not 73 bugs. Keep the existing game rules, wire contracts, dependencies, and native feature scope.

1. Give browser match requests a per-match lifetime, cancellation, revision guards and command ownership. Treat an accepted command separately from a failed refresh.
2. Make socket connection ownership, worker settlement, shutdown, notification operations and auth submission single-owner. Bound optional cleanup and release listeners on teardown.
3. Consolidate run start/completion/failure/recovery transitions. Persist chat reconciliation intents for known remote resources; retry compensation through bounded maintenance. Preserve authorization, reservations, quotas and scenario values.
4. Make native startup phases explicit and coalesce Material state updates. Keep existing navigation/role guards. Fix small UI lifetimes and isolate per-match presentation state.
5. Add race, failure, retry and recovery regressions. Run the full local checks, web flow matrix and Android flows. Record each inventory family's disposition and remaining platform/provider limits.

No game design changes or new dependencies are planned. Framework-owned protocols and correct small selectors remain delegated; they do not need a reducer just to rename a boolean.
