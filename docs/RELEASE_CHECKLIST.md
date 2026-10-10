# Release checklist

## Current gate

**Status: local Android phone testing.**

Google Play publication must remain disabled until the physical-device checklist in [LOCAL_ANDROID_TESTING.md](LOCAL_ANDROID_TESTING.md) has been completed.

## Automated gates

Required on every PR/main build:

- production dependency audit
- unit/security tests
- ESLint
- production Vite build
- Android readiness guard
- web performance budget
- browser/offline E2E
- local D1 migration application
- Wrangler dry run
- Capacitor Android sync
- signed validation AAB build
- AAB signature verification

## v1 product locks

Keep these stable while phone testing:

- package ID: `com.yvan.workoutcoach`
- version: `1.0.0`
- auth: Google + email magic link
- passkey UI: deferred to v1.1
- D1 as synced application data store
- Supabase Auth as identity provider
- no R2
- no Play publishing workflow
- first-party SVG exercise references only

## Before local phone test

- main CI green
- Pages production green
- Worker deployment matches green source
- Supabase delete-account function active
- production auth environment variables configured
- Supabase production Site URL correct
- Android callback redirect URLs allowed

## Local phone test

Follow [LOCAL_ANDROID_TESTING.md](LOCAL_ANDROID_TESTING.md).

Record any blocker before changing release infrastructure.

## After phone test passes

Only then:

1. decide whether v1.0 is ready for store packaging
2. review any issues found on device
3. generate/archive the permanent Android upload key
4. create/configure the Play Console app
5. enroll in Play App Signing
6. complete Data safety
7. complete the Health apps declaration
8. complete content rating
9. prepare store listing/screenshots
10. add internal testers
11. restore a deliberately reviewed Play upload workflow if automated upload is desired

## Passkeys

Passkey client work belongs to v1.1 and should not be mixed into the v1.0 phone-test fixes unless a separate decision changes scope.

## Publication rule

No Google Play upload, including internal testing, should be performed from this repository until the owner explicitly resumes Play publication after physical-device testing.
