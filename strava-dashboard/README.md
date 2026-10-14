# Strava training dashboard

One dashboard (`app/dashboard.jsx`), two ways to open it:

| | Where | Strava data comes from | Settings saved in |
|---|---|---|---|
| **claude.ai artifact** | https://claude.ai/artifact/SK4PjpBdnFV7e2HBUSVrXx | your claude.ai Strava connector | your claude.ai account |
| **Cloudflare Worker** | `https://strava-dashboard.adrian-ddf.workers.dev` | the Strava API, via the Worker | the Worker's KV |

`StravaDashboard.jsx` is the older single-file version for pasting into a claude.ai chat.

## Deploy to Cloudflare (one-time setup)

Everything happens in the browser: Cloudflare builds this folder straight from GitHub (Workers Builds) and redeploys on every push. Follow **[DEPLOY.md](DEPLOY.md)**.

Like the `portfolio` Worker, it is protected by Cloudflare Access and keeps its data in the `strava-dashboard` KV namespace (already created and referenced in `wrangler.toml`). Strava keys and Access settings are set in the Worker's **Settings → Variables and Secrets**; `keep_vars = true` keeps deploys from wiping them.

## Change the dashboard

```sh
cd strava-dashboard
npm install
npm run build     # rebuilds cloudflare/public/ and artifact/index.html
git commit -am "..." && git push   # Cloudflare redeploys automatically
```

Local development: `cd cloudflare && npm run dev` (skips Access on localhost). Set `STRAVA_CLIENT_SECRET` in `cloudflare/.dev.vars` (Strava always accepts `localhost` callbacks).

## Notes

- Form, fitness and fatigue come from Strava's Relative Effort (`suffer_score`), so treat them as estimates.
- Strava's activity list has no calories, so the Worker version shows ride energy (kJ ≈ kcal) and leaves calories blank for other sports. The artifact version shows Strava's calories.
- Strava allows 100 requests per 15 minutes and 1,000 per day. A normal sync uses one or two.
