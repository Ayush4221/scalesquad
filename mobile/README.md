# ScaleSquad Android foundation

Android-first Flutter app in the same repository as the existing web/backend.
This is the A1 development preview: finite splash, guest home, mission/role
walkthrough, navigation recovery, shared controls and disabled Beta voice.
No account, game, chat, push or
production network connection is simulated. Native authentication/backend work
is the next milestone, not a completed part of this preview.

## Toolchain

- Flutter **3.47.1**, revision `6655482ec06e547f90abf8ae7590466f4415978d`.
- Dart **3.13.1** (provided by that Flutter SDK).
- Android Studio JBR/OpenJDK **21**, Java/Kotlin compilation target **17**.
- Gradle **9.3.1**, Android Gradle Plugin **9.1.0**, Kotlin plugin **2.4.0**
  from the pinned Flutter template.
- Minimum Android API **26**; target/compile SDK **36** from the Flutter template.
- Direct dependencies are Flutter SDK, SDK `flutter_test` and `integration_test`.
  Their normal SDK-managed transitive packages are locked in `pubspec.lock`.

The `dev` flavor uses `com.example.scalesquad.dev` and **ScaleSquad Dev**.
The owner-approved `prod` flavor uses `com.ayushdhoot.scalesquad` and **ScaleSquad**.
Signed release APK/AAB builds require `master` and externally supplied signing
material. GitHub Actions builds them only after routine CI passes on `master`.
See [Android release setup](../docs/ANDROID_RELEASE.md). Production packaging
contains the current native preview; it does not add native account/game/chat
integration. No signing material is committed.

## Commands

From the repository root, generate approved assets after installing npm dependencies:

```sh
npm ci
npm run mobile:assets
cd mobile
flutter pub get --enforce-lockfile
flutter run --flavor dev
```

Root verification/build commands:

```sh
npm run mobile:assets:check
npm run mobile:check
npm run mobile:build
```

The runner checks the pinned Flutter/Dart versions. It launches the Dart executable
and Flutter tool snapshot directly, preserving argument boundaries on Windows.
It never upgrades the SDK or shells together a list of staged file paths.

Debug APK output: `mobile/build/app/outputs/flutter-apk/app-dev-debug.apk`.
To run the Android smoke test on a connected device:

```sh
cd mobile
flutter test integration_test/introduction_test.dart --flavor dev -d <device-id>
```

The smoke test also runs on an Android emulator. It does not establish real
authentication, Nexconn delivery, notifications or full native gameplay.

For native Playwright checks, build the normal app again after running an
integration test (which produces its own test-entry APK). Choose a dedicated
running emulator explicitly:

```powershell
npm run mobile:build
$env:ANDROID_SERIAL = 'emulator-5554'
npm run mobile:test:android
```

These checks install only the dev APK on that emulator, read fresh Android
accessibility hierarchies through Playwright's ADB transport, and exercise all
role choices, disabled voice, Android back, 200% text,
landscape and reduced system animation. They restore the emulator's text,
rotation and animation settings. Reports and screenshots go under
`.cache/android-native/report` and `.cache/android-native/results`, separate from
the web suite's output folders.
The separate existing web Playwright suite still tests sign-in, chat and the
complete game loop. See `DESIGN.md` and `../docs/MOBILE_REDESIGN_VERIFICATION.md`.

## Code and tests

- `lib/app`: bootstrap, licence registration, finite startup, route boundary and recovery.
- `lib/features/introduction`: presentation models, local controller and views.
- `lib/core/theme`: generated palette, shared Flutter theme and layout/motion tokens.
- `lib/core/constants`: user-facing text, accessible labels and asset paths.
- `lib/core/widgets`: licensed Lucide icons, logo, buttons, panels and voice BETA card.
- `test`: controller, widget, large-text, reduced-motion and golden checks.
- `integration_test`: standard native Flutter smoke-test entry.

The recorded Flutter test exception is in `../CLAUDE.md`. No test-copy layer or
per-feature package manifests exist. Generated colours come from
`../src/styles/palette.ts`. Re-run the asset exporter; do not edit Dart/XML
palette outputs manually. Lucide glyphs are exported from the installed web
library with 1x–4x density variants; Flutter applies semantic theme tints.
The existing approved logo/fonts and ISC/OFL licences are bundled. Licence texts
are registered with Flutter's licence registry at startup.

`npm run mobile:assets:check` checks both palettes, every icon density, launcher
icons, the logo, fonts and licence copies. It never rewrites files. PNG checks
compare pixels and dimensions when compression bytes differ across platforms.
Palettes and licence copies compare text with normalized line endings; font
files remain byte-exact. Generated text always uses LF on Windows and Linux.
Missing or stale files fail with their path and the regeneration command.

Feature pages receive navigation callbacks from the app router. They do not
import router implementations. The analyzer enforces Dart file, type, constant
and member naming conventions without a third-party lint package.

Golden baselines use the pinned Windows Flutter test renderer and bundled fonts;
CI uses that same platform for visual tests. Android compilation runs separately
on Linux. Both checks are required by the existing aggregate CI gate.

## Local Android networking for the next milestone

Keep the server's exact Host check and loopback bind. With the server configured
for `http://localhost:3000`, use adb port reversal rather than a LAN IP:

```sh
adb -s <device-id> reverse tcp:3000 tcp:3000
adb -s <device-id> reverse --list
```

The future native API/socket client uses the matching localhost origin. There is
no native network client in this slice and no weakened server/CSP permissions.

## Validation status

Flutter format/analyze and five controller/widget/golden tests passed locally.
The home visual baseline was inspected. The development APK built successfully;
its merged manifest has the expected development ID and no microphone/camera
permission. No Android device/emulator was connected, so the device integration
smoke test has not run. Native results are recorded in `../docs/IMPLEMENTATION.md`.

On this Codex Windows host, default Java local-pipe setup initially failed with
`Unable to establish loopback connection`. The manager-approved, command-scoped
`jdk.net.unixdomain.tmpdir` pointing at the ignored `.cache/udtmp` directory allowed
Gradle to configure the project. That temporary environment setting is not a
tracked Gradle property or a Windows/firewall change. A1 does not require a host
security change. Android licence acceptance and devices remain owner/toolchain
prerequisites where missing.
