# Google Play preparation

## Status: paused

Google Play publication is intentionally on hold while v1.0 is tested locally on a physical Android phone.

The repository currently contains **no Google Play Publisher API uploader and no Play upload workflow**.

This is deliberate. A successful build does not authorize publication.

## Stable Android identity

- application ID: `com.yvan.workoutcoach`
- current version name: `1.0.0`
- current default version code: `1`
- minimum SDK: 24
- compile SDK: 36
- target SDK: 36
- backups: disabled
- cleartext traffic: disabled
- permissions: Internet only

Do not change the package ID.

## What remains prepared

Gradle still supports environment-driven versioning and release signing so store preparation can resume without redesigning the Android project.

Normal CI builds a signed validation AAB using a disposable CI key. That file is **not** a Play upload artifact.

The manual Android workflow builds a debug APK for phone testing only.

## Before Play work resumes

The full physical-device checklist in [LOCAL_ANDROID_TESTING.md](LOCAL_ANDROID_TESTING.md) must pass.

Then review:

- Google login on Android
- email magic-link behavior on Android
- session persistence
- D1 sync
- offline recovery
- background timers
- account deletion
- final UI on the target phone

## Play Console work after approval to resume

When local testing is complete:

1. create/confirm the Play Console app for `com.yvan.workoutcoach`
2. enable Play App Signing
3. generate and securely archive a permanent upload keystore
4. add only the required signing secrets to GitHub if CI signing is desired
5. complete Data safety
6. complete Health apps declaration under Activity and Fitness
7. complete content rating
8. prepare icon/feature graphic/screenshots/descriptions/support contact
9. configure internal testers
10. decide whether upload remains manual or whether a new reviewed Publisher API workflow should be introduced

Do not create a Google service-account publishing credential until automated upload is actually needed.

## Policy URLs already implemented

- privacy: `https://workout-coach.pages.dev/privacy.html`
- account deletion information: `https://workout-coach.pages.dev/delete-account.html`
- secure account deletion: `https://workout-coach.pages.dev/delete-account`

## Passkeys

Passkeys are not part of the v1.0 store scope.

Supabase has the feature enabled, but client integration and Android WebAuthn validation are deferred to v1.1.

## Versioning

Until the first Play upload is actually accepted:

- keep repository default at `1.0.0 / 1`
- do not consume version codes for local APK testing

When Play uploads begin, increment `versionCode` for every submitted AAB.
