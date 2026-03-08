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

## Cloudflare D1 Setup

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

4. Apply migrations locally first:

```bash
npm run d1:migrate:local
```

5. Apply migrations to Cloudflare:

```bash
npm run d1:migrate:remote
```

## Worker Dev

Run the Worker locally in one terminal:

```bash
npm run cf:dev
```

Run Vite in another terminal:

```bash
npm run dev
```

Vite proxies `/api` to the local Worker at `http://127.0.0.1:8787`, so you do not need to paste a sync URL during local development.

## Production Deploy

Deploy the Worker:

```bash
npm run cf:deploy
```

Then either:

- paste the deployed Worker base URL into the app's `Cloudflare sync API URL` field, or
- set `VITE_SYNC_API_URL=https://your-worker.your-subdomain.workers.dev`

## API Routes

- `GET /api/health`
- `GET /api/snapshot`
- `POST /api/logs`
- `POST /api/sessions`

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

Planned next step:
- replace placeholders with true ExerciseDB-derived assets once source format and redistribution terms are confirmed

Recommended import workflow:
1. identify the exact ExerciseDB media source to use
2. confirm the license/terms for redistribution in this repository
3. import only the exercises used by this app into a local folder
4. keep originals or a manifest outside git if licensing requires it
5. update `THIRD_PARTY_NOTICES.md` with attribution/source details

See `THIRD_PARTY_NOTICES.md` for the repository policy around third-party exercise media.

## License

This project is licensed under the MIT License. See `LICENSE`.
