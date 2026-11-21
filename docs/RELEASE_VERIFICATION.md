# Release preparation verification

Date: 2026-11-21. Target branch: `development`.

| Check                                             | Result                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint and formatting                               | Passed                                                                                                                                      |
| TypeScript                                        | Passed                                                                                                                                      |
| Unit tests and coverage                           | 520 passed in 58 files; existing coverage gates passed                                                                                      |
| PostgreSQL integration                            | 11 passed in 2 files, using isolated `scalesquad_submission_test`                                                                           |
| Web/server production build                       | Passed                                                                                                                                      |
| Browser flows                                     | 105 passed in the full matrix; one Windows worker exited before its test ran, and that exact Android-profile test passed on a focused rerun |
| Flutter format, analysis, widget and golden tests | 20 passed; no analyzer issues                                                                                                               |
| Android development APK                           | Built successfully, including after production flavor configuration                                                                         |
| Mobile generated assets                           | Passed                                                                                                                                      |
| Production dependency audit                       | Zero vulnerabilities after pinning Prisma config's transitive Effect dependency to 3.22.1                                                   |
| Secret checks                                     | Existing Git history and staged text diff passed with redaction                                                                             |
| Release branch boundary                           | 13 unit checks passed; actual CLI and Gradle dry-run both refused release from `development`                                                |
| Signing environment                               | `android-production`, only `master`, four encrypted secret names verified through GitHub API                                                |

No production APK/AAB was built from `development`. After merging to `master`
and passing required CI, the release job builds and verifies signed APK/AAB
artifacts. The Android package is `com.ayushdhoot.scalesquad`; it contains the
current native preview, not native authentication or live gameplay.

The private upload key and passwords are ignored, stored locally in a restricted
folder, and excluded from commit/build artifacts. Public source does not include
signing material. See [release setup and Google Console steps](ANDROID_RELEASE.md).

The transitive dependency patch addresses
[GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
