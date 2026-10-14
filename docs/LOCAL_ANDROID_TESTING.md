# Local Android testing

## Release decision

Google Play publication is paused until Workout Coach has been tested on the owner's physical Android phone.

A successful CI build is not a substitute for this test.

## Prerequisites

Recommended local environment:

- Node.js 22
- npm
- Java 21
- Android Studio and Android SDK
- Android platform/SDK 36
- Android Debug Bridge (`adb`) for command-line installation

Enable Developer options and USB debugging on the phone.

## Connected test configuration

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Populate:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SYNC_API_URL
```

For auth tests, Supabase URL Configuration must permit the Android WebView callback destinations used by the app:

- `https://localhost`
- `https://localhost/delete-account`

The Worker allowlist already supports `https://localhost`.

## Build a debug APK locally

```bash
npm ci
npm run android:debug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install with adb:

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

If an older build signed with a different debug key is installed, uninstall it first and then reinstall.

## Android Studio route

Build/sync and open the project:

```bash
npm run android:open
```

Select the physical phone as the run target in Android Studio.

## Website download route

The current connected Android test APK is published directly on the production site:

`https://workout-coach.pages.dev/downloads/workout-coach-android.apk`

From the homepage, tap **Download Android APK**, open the downloaded file, and approve Android's install-from-this-source prompt if required. On Xiaomi/HyperOS this permission may be attached to the browser or Files app that opened the APK.

The website APK is integrity-checked in CI against `public/downloads/android.json` and is excluded from the service-worker cache so a replaced APK is not served stale.

If Android reports a signing conflict when replacing an older test build, uninstall the older Workout Coach test copy first. This removes that copy's local-only data. Test signing is temporary until the production Play signing path is activated.

## GitHub artifact route

The **Android Device Test Build** workflow creates `workout-coach-phone-test-apk`.

- Every push to `main` automatically produces an auth/sync-connected APK.
- Manual runs default to `connected_build=true`.
- A manual `connected_build=false` run produces a local-only APK.
- The Supabase URL, publishable client key and Worker URL are public frontend configuration and are defined directly in the workflow; no GitHub secrets are required for the APK build.
- The workflow has no Google Play upload capability.

## Mandatory phone-test checklist

### Install and startup

- fresh install succeeds
- app opens without a blank screen
- icon and splash screen display acceptably
- portrait layout fits the device
- safe areas and system bars do not cover controls

### Local-only behavior

- app is fully usable while signed out
- start a workout
- complete warmup
- complete rep-based sets
- complete timed sets
- pause/resume timers
- background the app during a timer, return and verify correct remaining time
- close/reopen mid-session and verify state recovery
- finish a session and verify Day A/B/C rotation
- export CSV
- enable airplane mode and verify cached app-shell recovery

### Exercise/session UI

- all exercise SVG references render
- warmup YouTube embed works
- cooldown YouTube embed works
- voice guidance works or fails gracefully if the selected Android voice is unavailable
- haptics do not cause crashes
- readiness/load/RPE controls are usable with the keyboard

### Google authentication

- Google sign-in starts from the Android app
- callback returns correctly
- signed-in identity is displayed
- synced history loads
- a completed set/session appears in D1-backed history
- sign out returns to local-only mode
- sign back in and verify session persistence/sync

### Email magic link

- request a magic link
- open it from the phone's email client
- verify the session completes correctly
- verify sync after login

### Deletion

Use a disposable test account.

- create workout history
- delete the account from the app
- verify the app returns to a cleared local state
- verify the account can no longer authenticate
- verify the old synced history does not reappear

### Stability

- rotate/reopen/background the app repeatedly
- verify no repeated login loop
- verify no duplicated set logs after reconnect
- verify no runaway battery/audio behavior after leaving a session

## Exit criteria

Local phone testing is complete only when:

- no blocker remains in startup, session flow, timers or persistence
- Google login works
- magic-link login works
- sync works after reconnect/relaunch
- account deletion works with a test account
- offline recovery works
- no unacceptable UI issue remains on the target phone

After these criteria pass, update [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and decide whether to resume Google Play preparation.
