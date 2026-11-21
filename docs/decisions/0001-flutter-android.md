# Decision 0001 — Flutter Android client alongside the web PWA

Date: 2026-11-07. Status: owner-approved direction; SDK-only Android foundation started.

## Context and decision

The previous mobile decision was PWA-first, with native work conditional on
demonstrated push/store needs. The owner explicitly requested a native Android
application built with Flutter in this same repository. That product request
supersedes the conditional PWA-only roadmap; it is not a finding that the PWA is
broken. Keep Next.js and the PWA for web; share the Node backend, accounts,
Postgres data, simulator and authorization with the new client.

Flutter belongs at `mobile/`, with Dart under `mobile/lib` and one pubspec/lockfile.
Keep the single npm package and standard Next.js structure. Flutter MVC separates
views, controllers, repositories and I/O adapters. Voice stays disabled with BETA.

## Recorded test exception

The owner explicitly approved, in this chat on 2026-11-07:

- Flutter unit/widget/golden tests in `mobile/test`.
- Flutter integration tests in `mobile/integration_test`.
- Shared TS/Dart contract fixtures in root `tests/contracts`.
- Existing web/server tests stay in root `tests/`.

There is no staging/copy/symlink layer. This narrowly supersedes the older
all-tests-at-root rule for Flutter only; CLAUDE.md and architecture record it.

## CI exception and consequences

During initial emulator stabilization, only the new Android-emulator integration
job is advisory. Analysis, contract drift, native unit/widget/golden tests and
debug build are required. Existing Playwright jobs remain required. Track
promotion after 20 representative clean runs plus the real-device playtest.

Native auth/socket adapters need contracts; they must not bypass web Origin/Host
controls. Shared fixtures/generation and root-tool exclusions prevent drift and
tool collisions. Dependency, supply-chain, privacy and release gates precede
deployment. See the [Android plan](../plan/14-flutter-android.md).
