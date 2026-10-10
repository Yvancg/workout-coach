# Workout Coach

Workout Coach is a mobile-first workout companion built with React, Vite and Capacitor. It supports guided sessions, timers, offline-first workout logging, progression suggestions, optional private sync and an Android shell.

## Current release status

**v1.0 is in local phone testing. Google Play publication is intentionally paused.**

The repository contains no active Google Play upload workflow. The next release decision happens only after the app has been tested on a physical Android phone.

Current authentication exposed in the app:

- Google sign-in
- email magic link

Supabase passkeys are enabled at project level, but the client does **not** opt in to passkeys in v1.0. Passkey registration, sign-in and Android/WebAuthn testing are deferred to v1.1.

## Architecture

```text
React / Vite PWA
      |
      | Supabase session JWT
      v
Supabase Auth
      |
      v
Cloudflare Worker API
      |
      v
Cloudflare D1
```

Local reliability is independent of cloud sync:

- `localStorage` holds the fast-start state
- IndexedDB mirrors state as a recovery copy
- an IndexedDB outbox queues authenticated writes while offline
- the service worker provides PWA app-shell recovery
- D1 stores synced workout logs and session history
- Supabase is used for authentication, not application data
- R2 is not used

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Quick start

Requirements:

- Node.js 22
- npm
- Java 21 and Android SDK only when working on Android
- Wrangler authentication only when working on the Worker/D1 deployment

Install dependencies:

```bash
npm ci
```

Create local frontend configuration:

```bash
cp .env.example .env.local
```

Run the web app:

```bash
npm run dev
```

Optional Worker development:

```bash
cp .dev.vars.example .dev.vars
npm run cf:dev
```

Vite proxies `/api` to the local Worker at `http://127.0.0.1:8787`.

## Environment variables

Frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SYNC_API_URL
```

Worker:

```text
ALLOWED_ORIGINS
SUPABASE_URL
SUPABASE_JWT_AUDIENCE
WRITE_RATE_LIMIT_MAX
WRITE_RATE_LIMIT_WINDOW_SECONDS
AUDIT_LOG_ENABLED
```

The Worker accepts authenticated Supabase JWTs only. The old standalone admin-token fallback has been removed.

## Validation

Run the same core checks used by CI:

```bash
npm audit --omit=dev --audit-level=high
npm test
npm run lint
npm run build
npm run check:web-budget
npm run check:android
npm run test:e2e
```

CI also:

- applies all D1 migrations locally
- performs a Wrangler Worker dry run
- syncs Capacitor Android
- builds and verifies a signed validation AAB using a disposable CI key

The CI AAB is validation-only and is not a Google Play artifact.

## Android phone testing

The current priority is physical-device testing before any store work.

Use:

```bash
npm run android:debug
```

This produces:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the project in Android Studio:

```bash
npm run android:open
```

GitHub Actions also builds **Android Device Test Build** automatically on every push to `main`, producing a connected debug APK that can be downloaded directly on the phone. Manual runs can still choose connected or local-only mode. The workflow has no publication step.

Full instructions and the phone-test checklist are in [docs/LOCAL_ANDROID_TESTING.md](docs/LOCAL_ANDROID_TESTING.md).

## Authentication

Current v1 auth:

- Google OAuth
- email magic link
- persistent Supabase browser/Capacitor session
- Worker verification against the Supabase JWKS
- self-service account deletion

Passkeys remain a v1.1 item even though they are enabled in Supabase.

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

## Sync and data protection

Workout state is always saved locally first.

When signed in, writes are queued in IndexedDB and synchronized to the Worker. Log writes carry a client-generated idempotency key so retries do not duplicate sets.

Timers use absolute deadlines so background throttling can be reconciled when the web view resumes.

Account deletion removes:

- synced D1 workout logs
- synced D1 session history
- account-linked audit/rate-limit records
- the Supabase Auth user
- local state and queued sync operations on the device completing deletion

Public policy pages:

- Privacy: `https://workout-coach.pages.dev/privacy.html`
- Account deletion information: `https://workout-coach.pages.dev/delete-account.html`
- Secure deletion flow: `https://workout-coach.pages.dev/delete-account`

## D1 migrations

Apply locally:

```bash
npm run d1:migrate:local
```

Apply to production only after validation:

```bash
npm run d1:migrate:remote
```

Current migrations cover the base workout tables, session metadata, ownership, rate limiting, auditing, owner IDs, log idempotency and progressive-coaching fields.

## Worker

Local:

```bash
npm run cf:dev
```

Deploy:

```bash
npm run cf:deploy
```

Production runtime variables are managed in Cloudflare and preserved by `keep_vars = true` in `wrangler.toml`.

The weekly cron `0 9 * * 1` performs a low-noise Supabase Auth health request and does not write user data.

## API

Public:

- `GET /api/health`

Authenticated:

- `GET /api/snapshot`
- `GET /api/whoami`
- `GET /api/history-summary`
- `POST /api/logs`
- `POST /api/sessions`
- `PATCH /api/sessions/:sessionId`
- `DELETE /api/sessions/:sessionId`
- `DELETE /api/account`

## Exercise reference media

The runtime now uses only the small first-party SVG reference cards in `public/exercise-reference/`.

Previously committed imported GIF/WebP exercise media was removed because its source manifest did not contain verifiable provenance. Third-party exercise media should not be reintroduced without a confirmed source and redistribution terms.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Local Android testing](docs/LOCAL_ANDROID_TESTING.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Google Play preparation](docs/GOOGLE_PLAY_RELEASE.md)
- [Documentation/reference files](docs/README.md)

## License

GNU GPLv3. See [LICENSE](LICENSE).
