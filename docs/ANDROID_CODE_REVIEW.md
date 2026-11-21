# Android foundation review — 2026-11-07

Reviewed commit: `62e5b5f` (`added the mobile android version`).

Follow-up: all three findings below have been addressed in the working tree.
The findings and initial verification remain as the original review record.
See the resolution section at the end for the changes and fresh results.

Scope: every authored Dart source and test, Android host/build settings and
manifests, dependency manifests, asset exporter, command runner, pre-commit
integration, CI changes and root-tool exclusions. Assets were checked through
the existing golden and the rebuilt APK; no manual comparison of every PNG.
Repository instructions, the architecture, Android plans and the foundation
bridge approval were used to distinguish approved exceptions from defects.

## Result

No blocking functional or security defect found in the implemented A1 preview.
Three low-priority improvements follow. These are maintenance/checking gaps,
not evidence of an exploitable vulnerability or broken current naming.

### 1. Naming conventions are followed but not enforced

Location: `mobile/analysis_options.yaml:15`.

The explicit lint list omits `file_names`, `camel_case_types`,
`constant_identifier_names`, and `non_constant_identifier_names`. CI can therefore
pass future names that violate the conventions used by the current source.
Add these SDK lint rules; no extra dependency is needed.

Current Dart names use snake_case files, PascalCase classes/enums and lowerCamelCase
members. Generated `app_colors.g.dart` and test `_test.dart` suffixes are consistent.
The TypeScript `xController.ts` naming rule should not be applied literally to Dart.
Android package/application identifiers are approved development placeholders.

### 2. Feature and router import each other

Locations: `mobile/lib/features/introduction/views/introduction_page.dart:3`
and `mobile/lib/app/router.dart:3`.

The page imports `AppRouter` for the mission route, while the router imports the
page to construct it. Dart permits this cycle and navigation currently works.
It couples the feature to app composition and makes the planned router replacement
touch feature code. Pass an `onExploreMission` callback into the page, or separate
route identifiers from the implementation. Keep route construction in the app layer.

### 3. Asset checks cover colors only

Location: `scripts/mobile-assets.mjs:40`.

`--check` returns after comparing the Dart and Android palettes. It does not compare
the exported icons, logo, fonts or license copies with their sources. A later web
asset/library update can leave mobile copies stale while this command still passes.
The current behavior is documented as a palette check, so this is an extension of
coverage, not a broken palette check. Compare the remaining generated assets or
record/check source hashes; include the mission assets beyond the home golden.

## Validation and security

- The only mutable feature input is a typed `SquadRole` enum. Re-selecting a role
  does not send duplicate notifications. The controller is disposed by its page.
- Views render local information. No HTTP, WebSocket, database, token storage,
  authentication or chat integration exists in this slice. There are no new server
  endpoints needing request schemas or authorization tests. Those future controls
  cannot be assessed from this preview.
- No server source changed in this commit. No bypass of existing Host/Origin or
  server authority was introduced by the Android foundation.
- The rebuilt APK uses the development ID, minimum API 26 and target API 36.
  Its permission list contains INTERNET and the app-scoped AndroidX non-exported
  receiver permission; no microphone, camera or notification permission.
- Voice remains disabled. Release tasks are guarded; production identity/signing
  are deliberately absent. Debug tooling and INTERNET permission are expected here.
- Direct dependencies remain SDK-only. Licenses are bundled and registered.
  Tokens, credentials and production URLs are not embedded in the authored client.

## Structure and conventions

The app/core/features split matches the approved plan. Views, local controller
and presentation model have separate files. There is no I/O requiring repositories
or services yet; adding empty layers would serve no current purpose. Shared colors
come from the canonical palette. Controller ownership and listener cleanup are clear.

Theme spacing, radii and several text styles remain inline in views/widgets. Move
repeated values into shared theme tokens as more screens arrive. Existing files
are small enough for this slice; the 219-line introduction page already extracts
its repeated visual sections into private widgets.

Root tools exclude native outputs. Staged Dart formatting uses bounded batches
and argument arrays. Both native CI jobs feed the required aggregate check.

## Fresh verification

- Palette drift check: passed.
- Dart formatting and Flutter analysis: passed; zero changes/issues.
- Existing Flutter tests: all 5 passed, including the home golden.
- Temporary review probes: all 13 passed (12 width/text-scale combinations and
  Android tap-target/label checks on both screens). Widths: 280, 320, 390 and
  844 logical pixels; text scales: 1, 2 and 3.2. Height: 640. Probes removed after use.
- Root lint/format and TypeScript checks: passed.
- Android development debug APK: rebuilt successfully and manifest inspected.

The first temporary accessibility probe had a test-harness cleanup error; after
correcting its cleanup and awaiting the guideline checks, the complete 18-test
run passed. This was not an application failure.

The build used the existing command-scoped Java temporary-directory workaround;
no tracked build or application settings changed. No fresh web browser/database
suite or GitHub-hosted CI run was performed for this review. Widget checks and
APK compilation do not establish real-device behavior, lifecycle handling or
production readiness. A fresh ADB check found no connected device or emulator,
so the device integration smoke test was not run.

Application code was not changed during this review.

## Resolution — 2026-11-07

- Enabled SDK naming lints for files, types, constants and members.
- Removed the introduction-page/router import cycle. App composition injects
  the mission navigation callback; existing navigation tests pass.
- Extended the shared asset pipeline so generation and checking use the same
  outputs. Checks cover both palettes, all Lucide densities, launcher icons,
  logo, fonts and licences. PNG comparison tolerates compression differences
  by comparing dimensions and decoded pixels. Check mode never writes files.
- Moved Android presentation copy into `AppStrings`. Moved web presentation
  copy into feature constants plus shared labels. Dynamic messages have typed
  builders. Existing common utility modules remain focused and reusable.
- Updated the PWA build to inline constants into its standalone worker and
  escape text inserted into the offline HTML.

Fresh checks after fixes: Flutter formatting/analysis and all 5 existing tests
passed; the unchanged home golden passed. Root lint/type checks and all 429
Vitest tests passed. Android debug APK rebuilt successfully. All seven deliberate
asset-corruption probes and a missing-file probe failed as expected; originals
were restored and the complete asset check passed. No dependencies were added.
The full web/server production build also passed, and the generated standalone
service worker loaded successfully in an isolated runtime check.

The initial restricted web/server test run could not open local connections;
the run with local connection access passed after correcting a shared helper's
import for the compiled simulator worker. Device smoke testing remains unrun
because no device/emulator is connected. Nothing was staged or committed.
