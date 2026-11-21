# Android production release

Production application ID: **`com.ayushdhoot.scalesquad`**. App label: **ScaleSquad**.
The `dev` flavor retains `com.example.scalesquad.dev` and **ScaleSquad Dev**.

This builds the current Flutter preview in release mode. Native accounts, live
gameplay and Nexconn transport are not implemented in that client yet. Use an
internal test track to evaluate the preview before considering a public launch.

## Branch and build behavior

1. Push and review changes on `development`.
2. Configure the signing environment described below.
3. Merge reviewed changes into `master`.
4. After every required CI job passes, the **Android production APK and AAB** job
   builds, verifies and uploads the signed files as a GitHub Actions artifact.

The release job runs only for a `master` push or a manual workflow run on
`master`. Pull requests, tags and other branches do not run it. Local CLI and
Gradle release tasks also require `master`; detached CI checkouts must match
the exact commit of a master push/manual run. Debug checks continue on branches.

Release builds keep Flutter's `--pub` step enabled for both APK and AAB so native
plugin registrants are regenerated in release mode. `--no-pub` can reuse the
development registrant from `flutter pub get`, referencing `integration_test`
even though Gradle excludes that dev-only plugin from the release classpath.
Keep `integration_test` in `dev_dependencies`; never edit the generated Java file.

Output paths:

- APK: `mobile/build/app/outputs/flutter-apk/app-prod-release.apk`
- AAB: `mobile/build/app/outputs/bundle/prodRelease/app-prod-release.aab`

The APK is suitable for direct installation; upload the AAB to Google Play.
The workflow does not publish anything to Google Play automatically. See
[Flutter's Android release guide](https://docs.flutter.dev/deployment/android).

## Signing setup in GitHub

The `android-production` environment is configured with a master-only branch
policy and all four encrypted signing secrets. The following describes the
settings to maintain or restore when rotating the upload key.

Create a GitHub environment named **`android-production`** under repository
Settings > Environments. Restrict its deployment branches to `master`.
Add these four environment secrets:

| Secret                      | Value                                        |
| --------------------------- | -------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Base64 encoding of your upload keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                            |
| `ANDROID_KEY_ALIAS`         | Alias of the upload key in that keystore     |
| `ANDROID_KEY_PASSWORD`      | Password for that key                        |

If an upload key already exists for this app, reuse it. Otherwise, generate an
upload key with Android Studio's signed bundle wizard or `keytool`, as described
in [Android's signing guide](https://developer.android.com/studio/publish/app-signing).
Back up the key and passwords securely. Signing files and local signing settings
are ignored by Git. The workflow removes its temporary keystore after the job.
Never use the development debug key as the production upload key.

An owner-authorized new upload key has been created locally in
`mobile/android/.release-signing/upload-keystore.jks`. The protected
`github-secrets.json` beside it contains the four values to copy into the GitHub
environment. `upload-certificate.pem` is the public certificate; it contains no
private key. Back up this entire local folder to a secure location. These local
files are not included in the repository or build artifacts.

For local builds on `master`, set `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, then
run `npm run mobile:release`. The keystore path must point to a real local file.
No credentials are accepted as command-line arguments or stored in source code.

CI uses its workflow run number as Android's version code. Increase the visible
version in `mobile/pubspec.yaml` for a new named release. For local releases,
`ANDROID_BUILD_NUMBER` can supply a positive, previously unused version code.
Rerunning one CI run retains that run's version code.

## Changes in Google Play Console

1. Create an app named **ScaleSquad**, with package name
   **`com.ayushdhoot.scalesquad`**, and choose its language, game/app classification,
   price and support contact. Follow the dashboard's setup tasks for the store
   listing, app content, privacy policy and Data safety answers. Describe the
   functionality and data handling of the actual Android build accurately.
   [Google Play setup guide](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en).
2. Set up **Play App Signing** when prompted. Keep your upload key separate from
   Google's app signing key. Register the public upload certificate if requested.
   [Signing and upload keys](https://developer.android.com/studio/publish/app-signing).
3. Create an **Internal testing** release and upload the signed AAB downloaded
   from the successful master workflow. Add testers and check the test build.
   Complete the required dashboard checks before requesting wider distribution.
4. If your personal developer account was created after November 13, 2023,
   Google's current production-access process requires a closed test with at
   least 12 testers continuously opted in for 14 days, followed by an application
   for production access. Check the requirements shown for your account.
   [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Package identity is fixed for updates to a published app. Do not upload the
development package as this app's first production bundle.

## If you meant Google Cloud Console / Google sign-in

The existing web OAuth configuration does not become native Android sign-in by
changing the package ID. The current Android preview has no Google sign-in flow.
When native Google sign-in is implemented, configure an Android OAuth client for
`com.ayushdhoot.scalesquad` and the relevant signing certificate. For a Play-delivered
app, obtain the app signing certificate from Play Console's app signing page;
its certificate differs from the upload certificate. Directly installed APKs
use their own signing certificate.

See [Google's Android identity documentation](https://developers.google.com/identity/android-credential-manager)
and [Android certificate registration](https://developer.android.com/studio/publish/app-signing).
