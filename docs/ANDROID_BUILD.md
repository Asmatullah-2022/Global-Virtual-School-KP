# Android Packaging

The app ships today as a mobile-first, installable PWA (service worker +
manifest already in place under `public/`). It is **not** a Flutter app —
the existing project was a Node/Express + vanilla-JS PWA, and rewriting it
in Flutter would discard working, tested code for no functional gain at
this stage. The recommended path to a real Android app is to wrap this PWA
with **Capacitor**, which packages it as a native Android project while
reusing 100% of `public/`.

This build does not include a generated Android project (no Android SDK in
this environment to verify a build), but here is the exact path:

## 1. Suggested package identifier

```
pk.gov.gvs.mobile
```
**This must be confirmed as permanent before any Play Store release** —
Android package IDs cannot be changed after publishing without shipping a
brand-new app listing.

## 2. Capacitor setup (run locally, not in this session)

```bash
npm install @capacitor/core @capacitor/android
npx cap init "Global Virtual School" "pk.gov.gvs.mobile" --web-dir=public
npx cap add android
npx cap sync
npx cap open android   # opens Android Studio
```

Point Capacitor's server config at your deployed API domain in production
(or serve `public/` from the same origin as the API, as this repo already
does, and just bundle it — no `server.url` override needed).

## 3. App identity in the Android project

- **App name**: Global Virtual School
- **Launcher icon**: derive PNG mipmaps from `public/icons/icon-512.svg`
  (Android Studio's Image Asset tool can do this) — do not invent a new
  logo or government seal.
- **Splash screen**: mirror `public/index.html`'s `#splash` (dark green
  gradient, gold "GVS" mark, slogan, org line) using
  `@capacitor/splash-screen`.

## 4. Permissions

Only request what's used:
- `INTERNET` (required)
- `ACCESS_NETWORK_STATE` (for the online/offline indicator)
- Avoid camera/microphone/location/contacts unless a specific approved
  feature needs them.

## 5. Network security config

Since the app only talks to your own HTTPS API and `gvskp.org`/`lms.gvskp.org`,
set `usesCleartextTraffic="false"` in `AndroidManifest.xml` and do not add a
custom `network_security_config.xml` trusting extra CAs.

## 6. Release build

```bash
cd android
./gradlew bundleRelease
```
Sign with a release keystore (`keytool -genkey -v -keystore gvs-release.keystore ...`)
and configure `signingConfigs` in `android/app/build.gradle`. **Never commit
the keystore or its passwords** — store them as CI secrets or locally only.

## 7. Before you build for real

- Confirm the package ID above with the client (Global Virtual School / KP
  government stakeholders) — it is a one-way door.
- Point the app at the production API URL, not `localhost`.
- Turn on `NODE_ENV=production` on the server so CORS is locked to the real
  domains (see `server/index.js`).
