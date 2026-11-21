# ScaleSquad mobile design

Hallmark v2.0.0, full redesign, app scope, playful genre, existing brand retained.

## Preflight and preserved material

- Palette: `../src/styles/palette.ts:1`, generated into `lib/core/theme/app_colors.g.dart`.
- Fonts: Chivo and Bungee, bundled in `pubspec.yaml:27` and themed in `lib/core/theme/app_theme.dart:9`.
- Material: the existing ScaleSquad mark, CampusPass mission, three roles and their existing descriptions.
- Wiring: `/`, `/mission`, the home callback, local role controller and disabled voice action remain.
- Native scope: this is the Android foundation described in `README.md`. Authentication, live gameplay, chat and push are not connected in this client.

## Shared system

`lib/core/theme/app_tokens.dart` holds the type families, spacing, radii, maximum
content width and motion durations. Colours stay generated from the web palette;
do not copy hex values into widgets. `app_strings.dart` holds presentation copy
and accessible labels; `app_assets.dart` owns asset paths.

Chivo carries interface text; Bungee is reserved for the brand. Heads use one
colour and weight. Labels use sentence case without tracking. The ink canvas,
solid cobalt mission panel and lime action identify the application. Surfaces
have one containment layer. The 560 logical-pixel measure stays centred on tablets.

## Screens and states

- Splash: a finite 850 ms logo settle with a working skip action. Reduced motion skips it. Disposal cancels the animation; returning from the mission does not replay it.
- Home: mission and primary action first, existing collaboration explanations below. The whole page scrolls, including at 200% text size.
- Mission: persistent back control, three selectable role buttons, an animated role detail, mission explanation, three-step walkthrough and disabled Beta voice. Large text stacks the selectors.
- Recovery: unknown routes show a generic message and a working return-home action. Route input and internal exception details are never shown.

Request loading, offline, network errors, empty matches and game results await
native networking implementation; the design does not simulate those outcomes.
Programming failures remain visible to Flutter diagnostics rather than being
silently swallowed by a global error screen.

## Interaction and verification

Buttons have a minimum 48 logical-pixel tap target, visible immediate keyboard
focus, pressed feedback and explicit disabled/loading behaviour. Press scaling,
role fades and route transitions respect the system reduced-motion preference.
No looping ornament or new dependency is used.

Hallmark's CSS scanner does not parse Dart. Its requested `--render` sweep reports
no supported files here, so it is not claimed as a native pass. Flutter analyzer,
tap-target/contrast checks, large-text flows and reviewed goldens cover the native
surface; emulator integration and Playwright Android checks cover actual controls.
