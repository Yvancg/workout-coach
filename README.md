# Workout Coach

React/Vite workout app with:
- mobile-first session flow
- installable PWA + Capacitor Android shell
- optional Cloudflare Worker + D1 sync

## Local App Dev

Run the frontend:

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

Then paste the deployed Worker base URL into the app's `Cloudflare sync API URL` field, or set:

```bash
VITE_SYNC_API_URL=https://your-worker.your-subdomain.workers.dev
```

## API Routes

- `GET /api/health`
- `GET /api/snapshot`
- `POST /api/logs`
- `POST /api/sessions`

## Notes

- Session metadata stored in D1 includes notes, available weights, warmup completion, and stretch completion.
- Local development can still run with no backend; sync is optional.
