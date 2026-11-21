# Mobile redesign verification

Date: 2026-11-11. Local Windows verification, Flutter 3.47.1 / Dart 3.13.1.

## Delivered scope

The native A1 client has a redesigned home and mission walkthrough, a finite
skippable splash, and a recovery screen for unknown routes. Shared Dart tokens
own fonts, spacing, radii and motion; shared constants own presentation strings
and asset paths. Existing role selection and the disabled Beta voice action stay
connected. No new application dependency or database migration was introduced.

Native authentication, live gameplay, chat and push remain planned milestones.
The complete game is exercised separately through the existing web client.

Development-only quota bypass covers HTTP/auth/WebSocket token buckets,
password-failure backoff and the daily match-creation quota. Production/test
enforcement, password verification, audits, authorization, Origin/Host checks,
payload limits and concurrent resource limits retain their normal rules.

## Flow coverage

| Native flow                                                                | Verification                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Splash completes, can be skipped, respects reduced motion, disposes safely | Flutter widget tests and reviewed splash golden                                      |
| Home opens the mission and returns without replaying splash                | Flutter tests, emulator smoke and native Playwright                                  |
| Traffic, Data and Operations switch details and announce selection         | Controller/widget tests and native Playwright                                        |
| New mission visit resets the local perspective                             | Flutter tests and native Playwright                                                  |
| Walkthrough and disabled voice remain reachable                            | Flutter tests, emulator smoke and native Playwright                                  |
| Voice requests no microphone permission                                    | Native Playwright checks installed package permissions                               |
| Large text, small phone, landscape and tablet                              | Flutter 200% text at 320×640, 844×390 and 1280×800; emulator 200% text and landscape |
| Unknown route recovers to home                                             | Flutter widget test and recovery golden                                              |
| Busy button blocks pointer/keyboard activation                             | Flutter widget tests                                                                 |
| Tap sizes, contrast and reduced-motion navigation                          | Flutter accessibility guidelines and widget tests                                    |

The four native Playwright cases run on the dedicated Pixel 7 AVD
`ScaleSquad_Review_API_35`, Android 15 / API 35, x86_64, WHPX, software graphics.
They install the normal dev APK, query fresh SDK accessibility hierarchies and
send real input through Playwright's Android ADB transport. The legacy Android
UI driver retained stale virtual Flutter nodes after restarts, so these tests
do not use its cached element handles. Settings are restored after the suite.

The web Playwright matrix covers desktop Chromium, Pixel 7 emulation and iPhone
WebKit: signup/sign-in, validation and errors, lobby membership and roles,
private evidence, failed chat, edit locks/conflicts, reconnects, mobile layout,
scenario selection and the complete three-player baseline/incident/repair loop.
These are disposable local test accounts and an isolated `*_test` database.
Optional configured-account tests are excluded.

## Check results

| Check                                                     | Final result                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run mobile:assets:check`                             | All generated assets current                                                  |
| `npm run mobile:check`                                    | Format/analyzer clean; 18 Flutter tests pass, including four reviewed goldens |
| `npm run mobile:build`                                    | Development debug APK built                                                   |
| Flutter integration test on emulator                      | 1 native smoke test passes                                                    |
| `npm run mobile:test:android` with the selected emulator  | 4 native Playwright cases pass, zero retries                                  |
| Web Playwright, three projects, two workers, zero retries | 106 cases pass in one clean final run                                         |
| `npm run test:cov`                                        | 459 tests across 51 files pass; all configured coverage gates pass            |
| `npm run test:db` on isolated local Postgres              | 10 tests pass                                                                 |
| Lint, type check, web/server build                        | All pass                                                                      |
| Gitleaks                                                  | 15 committed revisions and changed/new text checked; no leaks                 |
| Runtime dependency audit                                  | No vulnerabilities                                                            |

Coverage totals: statements 89.37%, branches 84.70%, functions 81.23%, lines
89.82%. Per-area thresholds remain enforced.

Logs live in ignored `.cache/mobile-redesign-*.log`; native screenshots and
report live in `.cache/android-native/results` and `.cache/android-native/report`.
The normal development APK is
`mobile/build/app/outputs/flutter-apk/app-dev-debug.apk`.

Reviewed Flutter goldens live in `mobile/test/goldens`: home, splash, mission and
recovery. The original home capture is retained locally in
`.hallmark/before-native.png`. The native design record is `mobile/DESIGN.md`.

Hallmark's requested `sloplint --render` reports that Dart is unsupported. No CSS
scanner or browser-render pass is claimed for native widgets. Native visual
review, Flutter accessibility checks and actual Android tests provide that
coverage. No invented API data or network failure screen was added.

The licence/line-ending regression test runs three exporter processes, each with
a 15-second limit. Its case now allows 45 seconds instead of the unrelated
five-second unit-test default; all drift and missing-file assertions remain.

Windows Vitest runs use two worker threads. The installed Windows Node runtime
aborted child-process workers in the WebSocket suite during coverage collection;
all the same cases and coverage thresholds pass with threads. Linux keeps its
existing default pool. Sign-out controls now remain disabled in server-rendered
markup until their handlers hydrate, with regression checks for both logout modes.

This is local verification. It does not establish a hosted GitHub Actions run,
real-provider delivery, release signing or production readiness.
