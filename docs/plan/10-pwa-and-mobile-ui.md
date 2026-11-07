# Step 10 — PWA and Mobile UI

**Goal:** make the existing Next.js app installable and fully usable on phones (Android first, iOS supported) as one codebase. Add a manifest, a security-safe service worker, Web Push, an install experience, and a mobile-first UI pass over lobby, brief, repair, results, and chat.

**Prerequisites:** Steps 01–09 (playable match on web). No auth or backend architecture changes: cookies, Origin checks, and the Nexconn web SDK keep working in an installed PWA.

**Decision record:** PWA first, one codebase for Android, iOS, desktop. Native app (React Native or Kotlin) only if push or store presence later proves necessary.

---

## Platform limits to design around

| Limit | Handling |
|---|---|
| iOS has no install prompt | Own install banner with Share → Add to Home Screen steps |
| iOS Web Push works only for installed PWAs (iOS 16.4+), permission must follow a user tap | Ask for permission only after install, from a button |
| Background apps drop WebSockets | Reconnect resync already built (full snapshot, step 06/07). Push covers "something needs you" |
| Storage can be evicted | Server authoritative, nothing important stored locally |
| Standalone-mode OAuth redirects can misbehave | Test Google and GitHub sign-in on a real iPhone and Android early (task 10.9) |

---

## Tasks

### 10.1 Web app manifest
- `apps/web/src/app/manifest.ts` (Next metadata route): `id`, `name` ScaleSquad, `short_name`, `start_url: /play`, `scope: /`, `display: standalone`, `orientation: portrait`, `theme_color`, `background_color`, `categories`, icons.
- Icons: 192, 512, and a **maskable** 512; `apple-touch-icon` 180 in `public/`. Generated from one source SVG with a script (`scripts/make-icons`), outputs committed.
- Root layout metadata: `appleWebApp` (capable, status bar style), `viewport` with `viewportFit: 'cover'`, `themeColor` for light and dark.

### 10.2 Service worker (security-critical)
Hand-written, small, auditable. Registered in production only.
- Pure decision logic in `apps/web/src/pwa/swLogic.ts` (unit-testable); `public/sw.js` imports the same rules (build step copies or inlines them).
- **Caches only:** versioned static assets (`/_next/static/**`, icons, fonts) and one `/offline` shell page.
- **Never caches:** any non-GET, `/api/**`, `/ws`, `/api/auth/**`, authenticated HTML/RSC responses, anything with `Set-Cookie` or `Cache-Control: no-store`, evidence, run results.
- Navigation requests: network first; on network failure show `/offline` (static, contains no user data).
- Cache names carry a version; `activate` deletes old caches. Updates: new worker waits; UI shows "Update available, reload" toast, user taps to `skipWaiting`.
- **Logout/purge:** on sign-out the page posts `PURGE` to the worker, which deletes all caches.
- Server side: `/sw.js` served with `Cache-Control: no-cache`; every `/api/**` and auth response sets `Cache-Control: no-store` (add to security headers middleware from step 06); CSP gains `worker-src 'self'` and `manifest-src 'self'`.

### 10.3 Web Push (VAPID)
- Env (names only): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; validated at boot. Private key server-only. Public key exposed to the client through a route, not bundled secrets.
- Prisma model `PushSubscription`: `id`, `userId`, `endpoint` (unique), `p256dh`, `auth`, `userAgent`, `createdAt`, `lastUsedAt`. Migration added.
- Endpoints (auth, origin check, rate limited, zod strict):
  - `POST /api/game/push/subscription` (create, idempotent on endpoint)
  - `DELETE /api/game/push/subscription` (remove own)
- **Endpoint URL validation (SSRF defense):** must be `https:`, no userinfo, default port only, hostname on an allow-list of known push services (for example `fcm.googleapis.com`, `*.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`); reject IP literals, `localhost`, private ranges. Max subscriptions per user (for example 5; oldest evicted).
- `pushService.notify(userId, kind, matchId)` using the `web-push` library:
  - Kinds: `MATCH_STARTED`, `EVIDENCE_AVAILABLE`, `LOCK_PASSED_TO_YOU`, `RUN_COMPLETED`, `MATCH_FINISHED`.
  - **Payload is content-free:** only `{ kind, matchId }`. Never evidence text, config values, or names.
  - Notification text comes from a fixed `kind → text` map **inside the service worker**, not from the server.
  - Delete subscription on 404/410 responses; log failures without endpoint URLs (redacted).
  - Send only to the intended user (for `EVIDENCE_AVAILABLE`, the owner only).
  - Skip when that user has an active foreground WS connection (avoid double notify).
- Hook into existing events: phase changes (07), evidence creation (08), lock handoff (08), run completion (09). Push failures never fail game operations.
- Service worker `push` handler shows the notification; `notificationclick` focuses an open client or opens `/match/:id`.
- Sign-out deletes the current device's subscription.

### 10.4 Install experience
- `useInstallPrompt` hook: captures `beforeinstallprompt` (Android/Chrome), exposes `canInstall`, `promptInstall()`.
- iOS detection (UA + not standalone) shows `InstallBanner` with Share → Add to Home Screen instructions and illustration.
- `isStandalone()` helper (`display-mode: standalone` and `navigator.standalone`).
- Dismissal remembered in `localStorage` (non-sensitive flag only; wrapped in try/catch).
- "Enable notifications" button appears only when: standalone (required on iOS), permission is `default`, and the user is signed in. Tap → permission request → subscribe → POST subscription.
- Settings sheet shows notification state with a disable action.

### 10.5 Mobile-first UI pass
Global rules:
- Design at 360–430px first; enhance at `md` (≥768) and `lg`.
- Use `100dvh`, never `100vh`; respect `env(safe-area-inset-*)` for top bar, bottom nav, chat input.
- Touch targets ≥ 44×44px. No hover-only interactions.
- Inputs use `font-size ≥ 16px` (prevents iOS zoom on focus).
- `overscroll-behavior: none` on app shell; no accidental pull-to-refresh mid-match.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`; portrait first.
- Connection and "reconnecting" banner at the top; offline state clear.
- Optional Screen Wake Lock during active match phases (feature-detected).

Add shadcn components: `drawer`, `sheet`, `switch`, `toggle-group`, `progress`.

Per-screen changes:

| Screen | Mobile layout |
|---|---|
| **Match shell** | Sticky top bar: phase name, timer, lock holder badge, connection dot. Bottom tab bar (Brief, Squad, Repair, Results, Chat) under `md`; sidebar layout from `md` up. Tabs enabled by phase |
| **Sign-in** | Full-width provider buttons, large tap area |
| **Play / Lobby** | Join code input with large type and paste support; code displayed large with Copy and `navigator.share`; roster as vertical list; sticky bottom action (Ready / Start) |
| **Private brief** | Card per fact, private indicator pinned, "Share to squad" opens chat sheet prefilled by the user (never auto-sent); sticky Acknowledge button |
| **Repair panel** | One control per row; selects open as bottom **Drawer** on mobile; switch for atomic check-in; current editor and version sticky at top; non-holder controls visibly read-only; Pass-control as drawer list |
| **Chat** | Full-height sheet; input stays above keyboard (visualViewport handling) and safe area; unread badge on tab; message list virtualized if long |
| **Run progress** | Full-screen progress with clear "locked" state |
| **Results / Comparison** | Table becomes stacked **metric cards** (before → after with delta and gate badge) on mobile; horizontal scroll fallback on tablets; failure reasons as expandable list; verdict badge pinned at top |
| **Incident evidence** | Full-screen card with "new private evidence" prompt, then share action |
| **Offline / Update toast** | Static offline page; "Update available" toast |

### 10.6 Responsive component refactors
- `ResponsiveSelect` (Select on desktop, Drawer on mobile), `ResponsiveDialog`, `MetricCard`, `BottomNav`, `TopStatusBar`, `SafeAreaView` wrapper. Located in `components/shared/`. Feature code uses these, not raw shadcn pieces, for the touched screens.
- `useMediaQuery` hook (SSR-safe).

### 10.7 Optional: Play Store listing (Trusted Web Activity)
Only if the owner decides: Bubblewrap project in `apps/android-twa/`, `/.well-known/assetlinks.json` served by the app, signing key kept outside the repo. Documented in the runbook (step 12). Skipped by default.

### 10.8 Documentation
- Update `docs/architecture.md`: PWA row in the decisions table, service-worker caching policy, push flow, mobile layout rules.
- `docs/mobile-ux.md`: breakpoints, component usage, tap target and safe-area rules, per-screen layouts above.

### 10.9 Real-device check (manual, recorded)
On a real Android phone (Chrome) and a real iPhone (Safari, iOS 16.4+): install, sign in with both OAuth providers in standalone mode, receive each push kind, background and resume mid-phase (state resyncs), play a full match on the phone viewport. Record results and any workarounds in `docs/mobile-ux.md`.

---

## Unit tests required (Vitest; Playwright mobile projects are added in step 12)

**Manifest and metadata**
- Manifest has required fields; `start_url` is inside `scope`; icons include 192, 512, maskable; every referenced icon file exists.
- Viewport metadata includes `viewport-fit=cover`; theme colors set for both schemes.

**Service worker logic (`swLogic`)**
- Table-driven `shouldCache(request, response)`: caches `/_next/static/**` GET 200; refuses `/api/**`, `/api/auth/**`, `/ws`, POST/PUT/DELETE, responses with `Set-Cookie`, `Cache-Control: no-store`, authenticated page HTML, evidence and results URLs.
- Navigation failure falls back to `/offline`; offline page markup contains no user data.
- Cache versioning: old cache names flagged for deletion; current kept.
- `PURGE` message clears all caches.
- Update flow: waiting worker does not take over until the skip message.

**Server headers**
- Every `/api/**` response includes `Cache-Control: no-store` (extend the middleware test).
- `/sw.js` served `no-cache`.
- CSP includes `worker-src 'self'` and `manifest-src 'self'`, still no `unsafe-eval`.

**Push endpoint validator**
- Accepts allow-listed `https` hosts; rejects `http`, userinfo, non-default port, IP literals (v4/v6), `localhost`, private ranges, non-allow-listed hosts, extremely long URLs, lookalike domains (`fcm.googleapis.com.evil.com`).

**pushService (fake `web-push`)**
- Payload contains exactly `{ kind, matchId }` (assert no other keys; sweep fixtures with evidence strings to prove none leak).
- Sends only to the target user's subscriptions.
- 404/410 removes the subscription; other errors keep it and do not throw into game flow.
- Per-user cap evicts oldest.
- Skips when user has active foreground connection.
- Kind map complete: every `kind` has SW text; unknown kind rejected.
- Logs redact endpoint and keys.

**Subscription controller**
- Strict schema; authz matrix (unauthenticated, other user's subscription delete attempt, rate limit).
- Idempotent re-subscribe; sign-out removes the device's subscription.

**Install UX hooks and components**
- `isStandalone` for each signal combination.
- iOS banner shown for iOS Safari UA (fixtures) when not standalone; hidden when standalone or dismissed; dismissal tolerates `localStorage` throwing.
- `beforeinstallprompt` captured and `promptInstall` called once.
- Notification button hidden unless standalone + permission default + signed in; permission request only on click.

**Responsive UI (jsdom with `matchMedia` mocks)**
- `ResponsiveSelect` renders Drawer on mobile, Select on desktop.
- `BottomNav` shows phase-appropriate enabled tabs; hidden at `md` and up.
- `TopStatusBar` shows phase, timer, lock holder, connection state.
- Results screen renders `MetricCard` list on mobile and table on desktop; a "better latency, duplicates remain" fixture still shows FAILED on both.
- Repair panel remains read-only for non-holders on both layouts.
- Chat input stays functional with simulated `visualViewport` resize.
- Touch target helper test: interactive components expose min size class (guards regressions).

## Security checks
- [ ] Service worker never caches authenticated pages, API, evidence, or results (tests above plus manual inspection of Cache Storage after a full match).
- [ ] Push endpoint URLs validated against an allow-list (SSRF defense), https only.
- [ ] Push payloads content-free; notification text fixed inside the worker.
- [ ] VAPID private key server-only; absent from client bundle (bundle grep in CI).
- [ ] Subscriptions bound to user; removed on sign-out and on 404/410.
- [ ] Permission prompts only from explicit user taps.
- [ ] Caches purged on sign-out.
- [ ] No tokens or evidence in `localStorage`/`sessionStorage`/IndexedDB; only UI flags allowed.
- [ ] `no-store` on all API responses; CSP updated without loosening script rules.

## Exit criteria
- App is installable on Android Chrome and installs to the iOS home screen; opens standalone with correct icon and splash.
- Push for each kind arrives on a real Android device and an installed iPhone, content-free, tapping opens the match.
- Full match is playable on a 360px-wide viewport without horizontal scroll or zoom-on-focus.
- Backgrounding mid-phase and returning resyncs state.
- Unit tests green; new code coverage ≥ 90% for `pwa/`, push services, and controllers.
- `docs/mobile-ux.md` and `docs/architecture.md` updated; real-device results recorded.
