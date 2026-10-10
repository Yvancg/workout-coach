# Authentication

## v1 scope

Workout Coach v1 exposes two sign-in methods:

- Google
- email magic link

Users may also remain signed out and use the app locally.

## Supabase client

The frontend uses `@supabase/supabase-js` with:

- session persistence
- automatic token refresh
- URL session detection

Protected sync requests send the Supabase access token to the Cloudflare Worker.

## Worker verification

The Worker accepts Supabase JWT authentication only.

It verifies:

- issuer
- audience `authenticated`
- JWKS signature
- user subject
- email claim

The old independent `API_TOKEN`/admin-fallback path has been removed.

## Redirect configuration

The production Site URL should remain the exact production app URL:

`https://workout-coach.pages.dev`

Because the client passes `redirectTo`, every redirect destination used by the app must be included in Supabase Authentication URL Configuration.

For Android phone testing, the Capacitor web view uses the HTTPS local origin. Permit the exact destinations required by the current code:

- `https://localhost`
- `https://localhost/delete-account`

If preview-deployment auth is needed, add only the preview pattern required for that testing and keep the production Site URL exact.

## Google

Google sign-in uses Supabase OAuth.

Physical-phone testing must verify that:

- the provider page opens correctly from the Capacitor shell
- the callback returns to Workout Coach
- the session survives closing and reopening the app
- D1 sync identifies the same Supabase user

## Email magic link

The app sends the current origin as `emailRedirectTo`.

On Android, verify that opening the magic link completes the flow and returns to the correct app/session context. If the mail app opens the link outside the Capacitor shell, record that as a release blocker rather than changing the redirect flow ad hoc.

## Passkeys

Supabase passkeys are enabled at project level.

They are **not part of v1**:

- the JavaScript client does not opt in to experimental passkey support
- there is no passkey sign-in button
- there is no passkey registration or management UI

Planned v1.1 work:

- lock the WebAuthn relying-party configuration before enrollment
- enable the Supabase client passkey feature
- add sign-in and signed-in registration/management UI
- test web behavior
- test Capacitor/Android origin behavior
- keep Google and magic link as fallback methods

Do not enroll production users in app-managed passkeys until the relying-party configuration has been finalized, because changing the RP ID invalidates previously registered credentials.

## Account deletion

A signed-in user can delete the account from the Account card or the public deletion route.

The flow deletes cloud workout data first, then deletes the Supabase Auth user, then clears local state on the device.

Use a test account when validating deletion on a phone.
