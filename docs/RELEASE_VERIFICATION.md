# Release preparation verification

Date: 2026-11-21. Target branch: `development`.

The Android release fix was also verified before commit in an isolated local
`master` checkout at `c74d5ed`, with the same `scripts/mobile-tool.mjs` change.

| Check                                             | Result                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint and formatting                               | Passed                                                                                                                                        |
| TypeScript                                        | Passed                                                                                                                                        |
| Unit tests and coverage                           | 524 passed in 59 files; existing coverage gates passed                                                                                        |
| PostgreSQL integration                            | 11 passed in 2 files, using isolated `scalesquad_submission_test`                                                                             |
| Web/server production build                       | Passed                                                                                                                                        |
| Browser flows                                     | 106 existing flows passed in the full matrix; all 3 new standalone-Next startup checks passed across desktop, Android and iOS profiles        |
| Flutter format, analysis, widget and golden tests | 20 passed; no analyzer issues                                                                                                                 |
| Android development APK                           | Built successfully, including after production flavor configuration                                                                           |
| Mobile generated assets                           | Passed                                                                                                                                        |
| Standalone Next startup                           | Production homepage, register, sign-in and Auth.js providers returned 200; protected pages redirected guests; no database required for guests |
| Release plugin regression                         | Reproduced stale integration-test registration with `--no-pub`; `--pub` regenerated the APK and AAB registrants without that dev-only plugin  |
| Production dependency audit                       | Zero vulnerabilities after pinning Prisma config's transitive Effect dependency to 3.22.1                                                     |
| Secret checks                                     | Existing Git history and staged text diff passed with redaction                                                                               |
| Release branch boundary                           | 13 unit checks passed; actual CLI and Gradle dry-run both refused release from `development`                                                  |
| Signing environment                               | `android-production`, only `master`, four encrypted secret names verified through GitHub API                                                  |

Signed production APK and AAB builds both passed in that `master` checkout.
APK verification passed with `apksigner`; AAB verification passed with
`jarsigner` and the expected signature entry was present. The package is
`com.ayushdhoot.scalesquad`, version `2.0.0` (code `2`), label **ScaleSquad**.
The signed APK installed and launched on the Android 35 emulator; home, mission
navigation and return worked without a process crash. AAB verification emitted
the upload key's self-signed certificate warnings and JAR streaming-layout
warnings; its file-based signature verification succeeded.

No production APK/AAB was built from `development`. After merging these fixes
into `master` and passing required CI, the release job still needs to be rerun
to verify the hosted Linux build. The Android package contains the current native
preview, not native authentication or live gameplay.

The Next startup fix does not mount the custom game/password APIs or WebSocket
server on Vercel. Only the public pages and Auth.js startup were verified in
standalone Next mode; full game flows were tested against the custom Node server.

The private upload key and passwords are ignored, stored locally in a restricted
folder, and excluded from commit/build artifacts. Public source does not include
signing material. See [release setup and Google Console steps](ANDROID_RELEASE.md).

The transitive dependency patch addresses
[GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
