# Workout Coach

React/Vite workout app with:
- mobile-first session flow
- installable PWA + Capacitor Android shell
- optional Cloudflare Worker + D1 sync

## Local App Dev

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

Optional frontend env values live in `.env` files. Start from:

```bash
cp .env.example .env.local
```

- `VITE_SUPABASE_URL` points the app at your Supabase project.
- `VITE_SUPABASE_ANON_KEY` is the public anon key from Supabase Auth.
- `VITE_SYNC_API_URL` can point the app at your deployed Worker without pasting it into the UI.

## Supabase + D1 Setup

1. Log in to Cloudflare:

```bash
npx wrangler login
```

2. Create the D1 database:

```bash
npx wrangler d1 create workout_coach
```

3. Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "workout_coach"
database_id = "YOUR_REAL_DATABASE_ID"
```

4. Set your allowed frontend origins in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://your-app.example.com,http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost"
```

5. Create a Supabase project and enable email magic-link auth.

In Supabase:

- create a project
- enable Email auth with magic links or OTP
- copy the project URL and anon key

6. Keep an admin fallback token only for scripts or emergency access:

```bash
npx wrangler secret put API_TOKEN
```

7. Set the Worker auth and fallback owner values in `wrangler.toml`:

```toml
[vars]
SUPABASE_URL = "https://your-project-ref.supabase.co"
SUPABASE_JWT_AUDIENCE = "authenticated"
ADMIN_FALLBACK_OWNER_EMAIL = "you@example.com"
ADMIN_FALLBACK_OWNER_ID = "admin-script"
WRITE_RATE_LIMIT_MAX = "60"
WRITE_RATE_LIMIT_WINDOW_SECONDS = "60"
AUDIT_LOG_ENABLED = "true"
```

- `SUPABASE_URL` is your project URL.
- `SUPABASE_JWT_AUDIENCE` is usually `authenticated` for browser sessions.
- `ADMIN_FALLBACK_OWNER_EMAIL` and `ADMIN_FALLBACK_OWNER_ID` are only for admin scripts using `API_TOKEN`.
- `WRITE_RATE_LIMIT_MAX` and `WRITE_RATE_LIMIT_WINDOW_SECONDS` cap write bursts on sync routes.
- `AUDIT_LOG_ENABLED` controls lightweight Worker audit logging for auth failures, rate-limit hits, session edits, and session deletes.

8. For Capacitor builds, keep `https://localhost` in the allowlist for Android and `capacitor://localhost` if you later run the app in an iOS shell.

Example `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-supabase-anon-key
VITE_SYNC_API_URL=https://your-worker.your-subdomain.workers.dev
```

The app uses Supabase Auth on the frontend and sends the Supabase access token to the Worker as a bearer token. The Worker verifies that JWT against the Supabase JWKS.

9. Apply migrations locally first:

```bash
npm run d1:migrate:local
```

10. Apply migrations to Cloudflare:

```bash
npm run d1:migrate:remote
```

11. Audit events are stored in D1 for security review. The Worker records:

- auth failures (`401` / `403`)
- write-route rate-limit hits (`429`)
- session edits
- session deletes

## Worker Dev

Run the Worker locally in one terminal:

```bash
npm run cf:dev
```

If you want admin fallback auth enabled in local Worker dev too, create a local secret before starting Wrangler:

```bash
npx wrangler secret put API_TOKEN --local
```

Run Vite in another terminal:

```bash
npm run dev
```

Vite proxies `/api` to the local Worker at `http://127.0.0.1:8787`, so you do not need to paste a sync URL during local development.

If you use auth locally, the app signs in through Supabase. The fallback bearer token is only for scripts or manual admin testing.

## Production Deploy

Deploy the Worker:

```bash
npm run cf:deploy
```

Then either:

- paste the deployed Worker base URL into the app's `Cloudflare sync API URL` field, or
- set `VITE_SYNC_API_URL=https://your-worker.your-subdomain.workers.dev`

If you prefer not to hardcode the Worker URL in a build, you can still leave `VITE_SYNC_API_URL` unset and paste the URL into the in-app sync API URL field on the device.

## API Routes

- `GET /api/health`
- `GET /api/snapshot` (auth required)
- `GET /api/whoami` (auth required)
- `GET /api/history-summary` (auth required)
- `POST /api/logs` (auth required)
- `POST /api/sessions` (auth required)
- `PATCH /api/sessions/:sessionId` (auth required)
- `DELETE /api/sessions/:sessionId` (auth required)

`/api/history-summary` returns grouped history rows ready for the app UI, so the client no longer needs to download the full raw log history just to render session cards.

The app currently exports raw CSV only from logs stored on the local device. Remote sync is used for grouped history summaries in the UI, not full raw-log rehydration.

The Worker also supports an admin fallback `API_TOKEN` for scripts, but normal app sync should use Supabase login.

## Stored Session Metadata

D1 session records currently include:
- session note
- available weights
- warmup completion
- stretch completion

## Exercise Reference Assets

Current state:
- `public/exercise-reference/` contains local placeholder reference cards used by the UI.
- these are safe local stand-ins and do not hotlink external media
- when imported ExerciseDB assets exist in `public/exercise-reference/imported/`, the app prefers them automatically and falls back to the local placeholder cards

Planned next step:
- replace placeholders with true ExerciseDB-derived assets from the official ExerciseDB source, cached locally only for the exercises used by this app

Recommended import workflow:
1. use the ExerciseDB free tier for personal-use lookup/downloads
2. fill in `scripts/exercise-asset-manifest.json` with the exact ExerciseDB image source URLs for each exercise used here
3. run:

```bash
npm run exercise-assets:import
```

4. review imported files in `public/exercise-reference/imported/`
5. keep the files local/personal-use unless you later confirm broader redistribution rights
6. update `THIRD_PARTY_NOTICES.md` with source details if you keep imported third-party media in the repo

See `THIRD_PARTY_NOTICES.md` for the repository policy around third-party exercise media.

## License

This project is licensed under the GNU GPLv3. See `LICENSE`.
