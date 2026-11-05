# Step 06 — Custom Server, Middleware, WebSocket Gateway

**Goal:** one Node process that serves Next.js, a small HTTP API, and an authenticated WebSocket gateway, with the full middleware stack (security headers, origin check, rate limit, error handling, logging).

**Prerequisites:** Step 05 (env, session resolution, DB client).

---

## Tasks

### 6.1 Bootstrap (`apps/server/src/main.ts`)
- Load and validate env (step 05). Create logger. Create Prisma client.
- Prepare Next: `next({ dev, dir: '../web' })`, `app.prepare()`.
- Create one `http.Server`. Request handler: run middleware chain → if path starts with `/api/game` route to our HTTP router; `/healthz` handled; everything else delegated to Next's handler (Auth.js routes stay in Next).
- Attach WS gateway to the same server on the `upgrade` event, path `/ws`.
- Graceful shutdown: on SIGTERM stop accepting, close WS with code 1001, drain, disconnect Prisma, exit within a timeout.
- Dev script: `tsx watch src/main.ts`; production: build to `dist` and run with node.

### 6.2 Logging (`lib/logger.ts`)
- pino with `redact` paths: `req.headers.cookie`, `req.headers.authorization`, `*.token`, `*.secret`, `*.payload` for evidence events, `*.apiKey`.
- Child loggers carry `requestId`, `userId` (when known), `matchId`.
- Log level from env. No `console.*`.

### 6.3 Middleware (`middleware/`), each a pure, testable function
1. `requestId`: accept none from the client; generate UUID; set `X-Request-Id`.
2. `securityHeaders`: `Content-Security-Policy` (default-src 'self'; script/style rules compatible with Next; `connect-src` includes own WSS and Nexconn endpoints once known; `frame-ancestors 'none'`), `Strict-Transport-Security` (prod), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
3. `originCheck`: for non-GET/HEAD/OPTIONS, require `Origin` equal to `APP_ORIGIN` (fallback `Sec-Fetch-Site: same-origin`); reject otherwise with `FORBIDDEN`.
4. `rateLimit`: token bucket per key (IP for anonymous, userId for authenticated), configurable per route group; in-memory Map with periodic cleanup; returns `RATE_LIMITED` with `Retry-After`. Interface allows swapping to Redis later.
5. `auth`: resolve session from cookie; attach `ctx.user`; routes declare `requireAuth`.
6. `bodyParser`: size-capped JSON parse; rejects non-JSON content type; returns `VALIDATION` on malformed.
7. `errorHandler`: maps `AppError` to status and safe body `{ error: { code, message, requestId } }`; unknown errors become `INTERNAL` with a generic message, logged with stack server-side only.

### 6.4 HTTP router and controller wiring
- `routes/http.ts`: tiny declarative table `{ method, path, auth, rateLimitGroup, controller }`. Unmatched → `NOT_FOUND`.
- `controller` signature: `(ctx) => Promise<Result>`; validates with zod via a `parse(schema, data)` helper that strips unknown keys and throws `VALIDATION`.
- First controllers: `GET /healthz` (no auth, no secrets), `GET /api/game/me` (returns `{ userId, name }`).

### 6.5 WebSocket gateway (`ws/`)
- Use `ws` in `noServer` mode.
- **Upgrade handler**:
  1. Check path and `Origin` against `APP_ORIGIN`; else 403 and destroy socket.
  2. Rate-limit upgrades per IP.
  3. Resolve session from cookie; no session → 401 and destroy.
  4. Accept, attach `{ userId, connectionId }`.
- **Envelope handling**: parse JSON with size cap (for example 16 KB); validate with shared WS envelope schema; unknown type or invalid payload → send `error` event, count violations, close after N violations.
- **Per-connection rate limit** on messages; **heartbeat** ping/pong with timeout to drop dead connections (also feeds edit-lock disconnect logic later).
- **Rooms** (`rooms.ts`): `join(matchId, socket)`, `leave`, `broadcast(matchId, event)`, `sendToUser(matchId, userId, event)`. Membership check is injected (a function from services) so rooms contain no DB code. `sendToUser` is the only path for private data.
- **Dispatcher**: `type → controller` map. Handlers receive `(ctx, payload)`; ctx has `user`, `matchId`, `reply`, `broadcast`.
- Only a `ping`/`hello` handler now; game events are added in steps 07–09.
- On disconnect: emit internal `userDisconnected(userId, matchId)` hook (used later by lock reclaim).

### 6.6 Web client plumbing (`apps/web/src/lib/ws`)
- `WsClient` class: connect, exponential-backoff reconnect with jitter, typed `send`/`on`, validates inbound messages with shared schemas, exposes connection state.
- `useWs` hook; connection status shown with a shadcn Badge.
- Never log message payloads in the browser console.

---

## Unit tests required

**Middleware** (table-driven, no network):
- `requestId`: unique per call; ignores incoming header.
- `securityHeaders`: every header present with expected values; HSTS only in production; CSP includes `frame-ancestors 'none'`.
- `originCheck`: allows exact origin; rejects different scheme/host/port, `null`, missing Origin with cross-site fetch metadata; GET exempt.
- `rateLimit`: allows up to burst, then blocks; refill over fake clock; separate keys isolated; cleanup removes idle keys; `Retry-After` correct.
- `auth`: valid cookie → user; missing → `UNAUTHENTICATED`; expired → `UNAUTHENTICATED`.
- `bodyParser`: rejects oversized, wrong content-type, malformed JSON, prototype-pollution keys (`__proto__`).
- `errorHandler`: `AppError` mapped correctly; unknown error → generic 500 without stack or message leak; includes `requestId`.

**Router and controllers**
- Unknown route → 404; wrong method → 405 or 404 consistently; auth-required route without session → 401.
- `parse` helper strips unknown keys and throws `VALIDATION` with field paths but not values.

**Logger**
- Redaction test: logging an object with cookie, token, secret, evidence payload outputs `[Redacted]` for each.

**WS gateway** (use `ws` against an in-process server on port 0)
- Upgrade rejected: wrong origin, no cookie, expired session (each asserted).
- Accepted with valid session.
- Oversized frame closes connection.
- Invalid JSON, unknown type, extra payload keys → `error` event; repeated violations close socket.
- Message flood is rate-limited.
- Heartbeat: unresponsive client terminated (fake timers).
- `sendToUser` reaches only that user's sockets; `broadcast` reaches room members only; non-member join denied.
- Disconnect fires the `userDisconnected` hook.

**WsClient (web)**
- Reconnect backoff sequence with fake timers; ignores invalid inbound messages; typed handler dispatch.

## Security checks
- [ ] Origin enforced on HTTP mutations and WS upgrade.
- [ ] No secret, cookie, or evidence in logs (redaction test).
- [ ] CSP does not use `unsafe-eval`; `unsafe-inline` limited to what Next requires (documented, nonce-based if feasible).
- [ ] Body size limits and WS frame limits set.
- [ ] Error bodies never include stack, SQL, or internal paths.
- [ ] `/healthz` exposes nothing sensitive (status only).
- [ ] Timeouts on HTTP server (`headersTimeout`, `requestTimeout`, `keepAliveTimeout`) set against slow-loris.
- [ ] Rate-limit keys derived from the real client IP only through a configured trusted proxy setting (Caddy), not from raw `X-Forwarded-For` trust.

## Exit criteria
- `npm run dev` starts one process serving the Next app, `/healthz`, `/api/game/me`, and `/ws`.
- A browser tab signed in connects over WS and shows "connected"; a signed-out tab is refused.
- All middleware and gateway tests pass; coverage ≥ 90% on middleware and `ws/`.
- Killing the process (SIGTERM) closes sockets cleanly.
