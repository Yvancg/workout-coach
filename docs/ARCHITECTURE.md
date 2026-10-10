# Architecture

## Purpose

Workout Coach is an offline-first workout companion with optional authenticated cloud synchronization. A workout must remain usable when authentication, the network or the sync API is unavailable.

## Runtime components

### React / Vite

The frontend owns:

- program selection
- guided warmup, exercise and cooldown flow
- rep and timed-set guidance
- rest timers
- readiness, actual load, completed reps/time and optional RPE input
- local history
- progression recommendations
- CSV export
- PWA installation

### Local persistence

`localStorage` stores the current application state for fast startup.

IndexedDB provides:

- a newer recovery snapshot when available
- a durable sync outbox for authenticated writes

The app restores local state before attempting remote synchronization.

### Supabase Auth

Supabase handles identity and sessions.

v1 exposes:

- Google OAuth
- email magic link

Passkeys are enabled in the hosted Supabase project but are intentionally not enabled in the JavaScript client until v1.1.

Supabase does not store Workout Coach application records.

### Cloudflare Worker

The Worker is the authenticated API boundary.

It:

- validates Supabase JWTs against the project JWKS
- caches the remote JWKS verifier at module scope
- applies origin restrictions
- applies write-rate limiting
- normalizes and bounds untrusted payloads
- writes security audit events
- reads/writes D1
- returns API responses with `Cache-Control: no-store`
- exposes the authenticated account-data deletion endpoint

There is no standalone admin-token authentication path.

### Cloudflare D1

D1 stores synchronized:

- workout logs
- session history
- ownership identifiers
- readiness
- warmup/stretch completion
- actual external load
- RPE
- idempotency keys
- rate-limit buckets
- audit events

D1 is the application database.

### Service worker

The service worker caches the PWA shell and same-origin static assets.

Rules:

- API routes are network-only
- navigation is network-first with cached app-shell fallback
- static same-origin assets are cache-first with refresh
- runtime cache size is bounded

## Data flow

### Local-only workout

```text
UI -> localStorage / IndexedDB
```

No account is required.

### Signed-in workout

```text
UI
 -> local save
 -> IndexedDB outbox
 -> Supabase access token
 -> Cloudflare Worker
 -> D1
```

A failed remote write remains queued and can retry after login, reconnect or the periodic sync cycle.

## Authentication flow

The browser/Capacitor client obtains a Supabase session.

Every protected Worker call sends:

```text
Authorization: Bearer <Supabase access token>
```

The Worker verifies issuer, audience and signature using the Supabase JWKS and derives ownership from the JWT subject/email.

## Account deletion

Deletion is deliberately split while the user still has a valid session:

1. `DELETE /api/account` removes the authenticated user's D1 data.
2. The JWT-protected Supabase Edge Function `delete-account` removes the Auth user using the server-side service role.
3. Local state and the sync outbox are cleared on the device completing deletion.

The service-role key never reaches the client. The deletion Edge Function also enforces the app origin allowlist and uses an exact Supabase client version pin.

## Progressive coaching

Progression is deterministic rather than AI-generated.

Inputs can include:

- comparable previous sessions
- completion rate
- RPE
- readiness
- currently available dumbbell weights

Recommendations move no more than one load step and avoid inventing external load for bodyweight movements.

## Android

Capacitor wraps the same web application.

Current package ID:

`com.yvan.workoutcoach`

Current Android target/compile SDK:

`36`

The phone-test build is a debug APK. Google Play publication is not part of the current workflow.

## Not used

- R2
- Google Sheets as the application database
- password authentication
- client-side passkeys in v1
- Google Play automated publishing during the phone-test phase
