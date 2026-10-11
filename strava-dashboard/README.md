# Strava training dashboard

One dashboard (`app/dashboard.jsx`), two ways to open it:

| | Where | Strava data comes from | Settings saved in |
|---|---|---|---|
| **claude.ai artifact** | https://claude.ai/artifact/SK4PjpBdnFV7e2HBUSVrXx | your claude.ai Strava connector | your claude.ai account |
| **Cloudflare Worker** | `https://strava-dashboard.<your-subdomain>.workers.dev` | the Strava API, via the Worker | the Worker's KV |

`StravaDashboard.jsx` is the older single-file version for pasting into a claude.ai chat.

## Deploy to Cloudflare (one-time setup)

This works like the `portfolio` Worker: Cloudflare Access protects it, the page is served from `cloudflare/public`, and data lives in the `strava-dashboard` KV namespace (already created and referenced in `wrangler.toml`).

1. **Create a Strava API app** at https://www.strava.com/settings/api.
   - *Authorization Callback Domain*: `strava-dashboard.<your-subdomain>.workers.dev` (just the host name, no `https://`).
   - Note the **Client ID** and **Client Secret**.

2. **Deploy once** from your laptop:
   ```sh
   cd strava-dashboard/cloudflare
   npm install
   npx wrangler login          # skip if you're already logged in from the portfolio Worker
   npx wrangler deploy
   npx wrangler secret put STRAVA_CLIENT_SECRET   # paste the Client Secret
   ```

3. **Turn on Cloudflare Access** (same as for `portfolio`): Cloudflare dashboard → Workers & Pages → `strava-dashboard` → Settings → Domains & Routes → `workers.dev` → **Enable Cloudflare Access**. Then open **Manage Cloudflare Access** and allow only your email. Copy the **Application Audience (AUD) tag**.

4. **Fill in `cloudflare/wrangler.toml` `[vars]`**:
   - `STRAVA_CLIENT_ID`: from step 1
   - `ACCESS_TEAM_DOMAIN`: the same value your portfolio Worker uses, e.g. `yourteam.cloudflareaccess.com`
   - `ACCESS_AUD`: from step 3
   - `ALLOWED_EMAILS`: your email

   Then run `npx wrangler deploy` again.

5. Open the workers.dev URL, sign in through Access, press **Connect Strava**, and approve. Your history loads, and later visits only fetch new activities. The Worker checks Strava at most every 5 minutes; **Settings → Full re-sync** refetches the latest 300.

Until step 4 is done, the Worker answers "Locked: Cloudflare Access is not configured", so it is never open to the public.

## Change the dashboard

```sh
cd strava-dashboard
npm install
npm run build     # rebuilds cloudflare/public/ and artifact/index.html
cd cloudflare && npx wrangler deploy
```

Local development: `cd cloudflare && npm run dev` (skips Access on localhost). Set `STRAVA_CLIENT_SECRET` in `cloudflare/.dev.vars` and add `localhost` as a Strava callback domain.

## Notes

- Form, fitness and fatigue come from Strava's Relative Effort (`suffer_score`), so treat them as estimates.
- Strava's activity list has no calories, so the Worker version shows ride energy (kJ ≈ kcal) and leaves calories blank for other sports. The artifact version shows Strava's calories.
- Strava allows 100 requests per 15 minutes and 1,000 per day. A normal sync uses one or two.
