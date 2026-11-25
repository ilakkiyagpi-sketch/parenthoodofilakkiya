# Happy Parenthood Android app

A **Trusted Web Activity**: the app opens https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/
full screen in Chrome's engine, so all data, Google sign-in, alarms and the Tamil interface work exactly
as in the installed web app. Plus a **home-screen widget** with five quick buttons
(😴 Nap · 🤱 Feed · 🥣 Meal · 💛 Pee · 🎤 Tell), which open `?go=quick:<action>`.

## Builds
GitHub Actions (`.github/workflows/android.yml`) builds it on every change to `android/`:
- With the secrets `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASSWORD` set: a **signed** app file.
  On `main` it is published at
  https://github.com/ilakkiyagpi-sketch/parenthoodofilakkiya/releases/latest/download/happy-parenthood.apk
- Without them: a test build only (kept with the run).

**Keep the signing key file (`happy-parenthood-release.jks`) and its password safe forever.**
Every update must be signed with the same key, or phones refuse to update.

## Full screen (no address bar)
Android checks `https://ilakkiyagpi-sketch.github.io/.well-known/assetlinks.json` (the main address of the
site, not the app folder). That file lives in the separate repository `ilakkiyagpi-sketch.github.io`
together with an empty `.nojekyll` file. Its content is `android/assetlinks.json` here.

## Package name
`io.github.ilakkiyagpisketch.happyparenthood`
