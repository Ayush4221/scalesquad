# Step 12 — Hardening, Playwright E2E, Deploy, Playtest

**Goal:** security review, integration tests with Playwright (lowest priority, done last), CI, Docker/Caddy deployment to the VPS, and the playtest protocol. Unit tests from earlier steps remain the primary safety net.

**Prerequisites:** Steps 01–11 (including the PWA, mobile UI, and email/password auth). E2E specs add a password flow (register → verify via file outbox → login → logout → reset) alongside the seeded-session specs.

---

## Tasks

### 10.1 Security hardening pass
Work through each item with evidence (test or documented check):
1. **Authorization matrix test suite** (`tests/authz.matrix.test.ts`): enumerate every HTTP route and WS event from the router/dispatcher registry; for each, assert behavior for unauthenticated, non-member, wrong role, wrong phase. Fails if a route is added without matrix coverage (registry-driven).
2. **Evidence leak sweep**: instrument a full-match service test to capture every outbound payload (WS, HTTP, logs, Nexconn calls, audit rows); assert no evidence string from any card appears anywhere except the owner's own authenticated fetch.
3. **Headers check** test: run the server in-process, request pages/API, assert CSP, HSTS (prod mode), nosniff, frame-ancestors, referrer policy.
4. **Dependency audit**: `npm audit --omit=dev` clean or documented; enable Dependabot; lockfile reviewed.
5. **Secrets scan**: run a secret scanner (for example gitleaks) over the tree; add to CI.
6. **Static checks**: lint rule bans `$queryRaw`, `eval`, `dangerouslySetInnerHTML` (allow-list none), `console.*`.
7. **Cookie and session review**: flags, expiry, rotation, logout invalidation tested.
8. **Rate limit tuning**: confirm values for join, auth, WS messages, run start; add tests for configured limits.
9. **Error surface review**: trigger errors in each layer; confirm generic client messages and full server logs with request ID.
10. **Input fuzz tests**: property tests (fast-check) feeding random JSON into every zod schema and WS dispatcher; assert no crash and no leaked internals.
11. **Nexconn failure modes**: provider timeouts and errors do not break game state; degraded banner shown.
12. Update `docs/architecture.md` security section with any changes.
13. **PWA security recheck**: service-worker cache audit, push allow-list tests, VAPID key absent from bundle, `no-store` on all API routes (from step 10), re-run against the production build.

### 10.2 Playwright E2E (integration, not blocking earlier steps)
Setup:
- `npm i -D @playwright/test`; `npx playwright install chromium`.
- `playwright.config.ts`: starts docker Postgres + server via `webServer`, `baseURL` local, trace on first retry. Projects: `chromium` (desktop), `mobile-android` (Pixel 7 emulation), `mobile-ios` (iPhone 13 emulation, WebKit). Mobile projects run the lobby, brief, repair, and full-match specs.
- **Auth in tests without hitting real OAuth:** a test-only helper seeds `User` and `Session` rows directly in the test database (using the dev seed code from step 05) and injects the session cookie into each browser context. No test-only login route exists in the app; the seed helper refuses to run unless `NODE_ENV=test`.
- Nexconn: point to a fake provider via `NEXCONN_PROVIDER=fake` env flag read only when `NODE_ENV=test`; production refuses this flag at boot.

Specs (each uses 3 browser contexts for 3 players):
1. `lobby.spec.ts`: create, join by code, ready, host starts; invalid and expired codes show errors.
2. `briefs.spec.ts`: each player sees only their own brief; player A cannot fetch player B's evidence via direct request (assert 403/empty).
3. `repair.spec.ts`: lock holder edits, others read-only; pass control; version conflict message.
4. `full-match.spec.ts`: complete match through `COMPARE`; asserts Run 2 FAILED and Run 3 PASSED with the reference repair applied through the UI.
5. `reconnect.spec.ts`: drop and restore one player's connection mid-phase; state resyncs; lock reclaim path.
6. `auth.spec.ts`: unauthenticated redirect to sign-in; signed-out WS refused.
7. `pwa.spec.ts`: manifest served and valid; service worker registers in production build; offline navigation shows `/offline`; after a full match, Cache Storage contains no `/api` or evidence entries; sign-out purges caches.
8. `mobile-layout.spec.ts`: at 360px width no horizontal scroll, bottom nav visible, repair drawer opens, comparison renders as cards.

`npm run test:e2e` runs the suite. Owner update (2026-11-07): all browser projects
are blocking CI jobs and feed the required `CI required` gate; no advisory bypass.

### 10.3 Container and deploy (VPS)
Files:
- `Dockerfile` multi-stage: install deps, build web and server, prune dev deps, run as non-root user, `HEALTHCHECK` on `/healthz`, read-only root filesystem where feasible.
- `docker-compose.prod.yml`: `app` + `caddy`; env via `env_file` on the host (never baked into the image); app not exposed publicly, only through Caddy.
- `Caddyfile`: automatic TLS for the domain, reverse proxy to `app:3000` with WS upgrade, security headers (mirrors app), request body limits, compression.
- `scripts/migrate.sh`: runs `prisma migrate deploy` with `DIRECT_URL` as a release step (not at app boot).
- `docs/runbook.md`: first-time VPS setup (firewall allowing 80/443/SSH only, SSH keys only, unattended security updates), deploy steps, rollback, log locations, backup note (managed Postgres backups on Neon/Supabase), OAuth callback URLs to configure for the production domain, secret rotation procedure.
- Trusted proxy setting: app trusts only Caddy for client IP (rate limiter).

### 10.4 CI (GitHub Actions assumed)
Jobs: `lint`, `typecheck`, `unit` (with coverage thresholds), `db-tests` (service Postgres), `build`, `audit`, `secrets-scan`, and blocking `e2e` projects. The aggregate `CI required` gate requires all routine jobs to succeed. The development ruleset import and Dependabot/default-branch behavior are documented in `docs/e2e.md`; repository settings must activate merge enforcement.

### 10.5 Playtest (design section 6)
- Add `docs/playtest.md` with the 10-step procedure, observation table, and success criteria copied from the design doc.
- Optional minimal feedback form at `COMPARE`: three questions (understood failure? repair helped? play again?) stored in a small table and exported for the team. Only stores answers, with the user's consent shown.
- Run with three people who did not build the project; no coaching.
- Record outcomes; tune **scenario JSON** and brief text first, rules only if necessary (bumping `engineVersion`).

### 10.6 Final acceptance
Walk the design doc section 10 checklist item by item; mark each with the test or demo that proves it. Anything unproven stays open.

---

## Unit tests required (additions this step)
- Registry-driven authz matrix (above).
- Evidence leak sweep.
- Header assertions.
- Fuzz tests on schemas and dispatcher.
- Config tests: `NEXCONN_PROVIDER=fake` and test-seeding refused when `NODE_ENV=production` (boot fails fast).
- Rate limiter trusted-proxy parsing (spoofed `X-Forwarded-For` from an untrusted peer is ignored).
- Container smoke test script: build image, run, hit `/healthz`, confirm non-root user.

## Security checks (final gate)
- [ ] All items in 10.1 complete and evidenced.
- [ ] Production boot refuses test-only flags.
- [ ] No secrets in image layers (`docker history` inspected) or repo (scan clean).
- [ ] TLS A-grade configuration verified; HSTS enabled.
- [ ] Only ports 80/443/SSH open; Postgres reachable only over TLS from the VPS.
- [ ] OAuth redirect URIs restricted to the production domain.
- [ ] Backups and rollback tested once.

## Exit criteria
- CI green (E2E allowed to be flaky-marked until stable, but must pass locally).
- App reachable over HTTPS on the VPS; three real accounts complete a match.
- Playtest executed with three new players; results recorded against the design doc criteria.
- Design doc section 10 checklist reviewed with evidence.
