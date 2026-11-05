# Mobile and installation

One Next.js app supports phone and desktop. `src/app/manifest.ts` defines a
standalone portrait app starting at `/play`. Icons in `public/icons` come from
one SVG; regenerate with `npm run pwa:icons` (Next.js supplies sharp).

## Layout

Phone layout applies below 768px, with desktop Select/dialog above that point.
The shell uses dynamic viewport height and safe-area insets. Buttons and inputs
have 44px minimum targets; input text is at least 16px. Motion reduction is
respected. The match status bar keeps phase, countdown, editor and connection
visible. Brief, Squad, Repair, Results and Chat tabs form the phone bottom bar.

Use `components/shared/ResponsiveSelect`, `ResponsiveDialog`, `BottomNav`,
`TopStatusBar`, `MetricCard` and `SafeAreaView` for touched screens. Drawers and
sheets use the existing shadcn/Base UI Dialog foundation without a new framework.
Repairs remain read-only for non-holders; run progress blocks edits. Results
show before/after cards on phones and a table on desktop, with the same verdict.
Failure reasons expand on demand. Chat keeps a bounded 100-message window and
adapts to `visualViewport` changes. Share-to-squad fills a draft only; the user
must press Send. Drafts and private facts stay in memory.

## Cache rules

`src/pwa/swLogic.ts` is the single decision source. `npm run pwa:build` inlines it
with `src/pwa/worker.js` into generated `public/sw.js`. Development does not
register a worker. Production caches only versioned `/_next/static` assets,
named icons/fonts and the static `/offline` shell. It refuses mutations, API,
auth, WebSocket, HTML/RSC, Set-Cookie, no-store/private responses and foreign
origins. Navigation goes to the network; failure shows the user-free shell.
All API responses are no-store; sw.js is no-cache. CSP permits same-origin
worker and manifest loading. Waiting workers activate only on a Reload tap.
Activation deletes old caches; logout posts PURGE and clears Cache Storage.

## Push status

Strict subscription controllers and the Postgres migration are implemented.
Endpoints must be HTTPS on approved FCM, Mozilla, Apple or Windows push hosts,
with no credentials, fragment, non-default port, IP literal or lookalike domain.
Subscriptions are owner-bound, idempotent and capped at five devices. The service
only sends `{kind, matchId}`, removes 404/410 subscriptions and skips foreground
sockets. Visibility updates reach the server through a validated WS event.
Fixed worker text covers match start, new evidence, edit handoff, completed run
and match finish; evidence notification targets only its owner. No facts or
configuration values enter a push payload.

The plan-specified `web-push` transport is wired with encrypted delivery, a 60-second
TTL, socket timeout and bounded sending concurrency. Configure all three server
environment fields: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
Boot validates the matching P-256 pair and contact URI. Only the public key is
returned to authenticated clients. With no keys, settings reports notifications
unavailable; there are no fake notifications. Generate persistent keys in a secure
local console with the library's `generateVAPIDKeys()` helper and keep the private
key outside Git and chat. VAPID setup and physical-device delivery checks remain.

## Installation

Chrome's install event is captured and invoked from a tap. iOS users see Share →
Add to Home Screen guidance. Dismissal stores a non-sensitive flag and tolerates
blocked storage. Notification permission is requested only from a tap after
installation and sign-in. Settings supports disabling the current device.

## Checks recorded on 2026-11-05

| Check                                                                                                                     | Result                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Real local app sign-in and registration at 360×800 in desktop browser                                                     | Pass: registration content width 360px, no horizontal overflow, measured inputs/buttons 44px high, input font 16px |
| Cache decisions, install hooks, responsive controls, content-free worker notifications, purge and waiting-update behavior | Automated regression tests                                                                                         |
| Android physical device install, standalone Google/GitHub login, all push kinds, background/resume, full match            | Not run: requires a device and configured live services                                                            |
| iPhone physical device install, standalone OAuth, all push kinds, background/resume, full match                           | Not run: requires an iPhone and configured live services                                                           |
| Live Cache Storage inspection after a full authenticated match                                                            | Pending configured end-to-end device run                                                                           |

Desktop viewport emulation does not establish iOS/Android installation or push
delivery. TWA/store publication is skipped as the plan specifies by default.
