# Deploying the Strava dashboard to Cloudflare, all in the browser

About 20 minutes on a computer. No terminal, no API tokens. Cloudflare builds straight from this GitHub repo and redeploys whenever the branch changes.

Have two tabs open: **Cloudflare** (https://dash.cloudflare.com) and **Strava** (https://www.strava.com).

---

## Step 1: Note your workers.dev address (1 min)

1. Cloudflare → left menu **Workers & Pages** (under **Compute** on some accounts).
2. Click **portfolio**. Its address looks like `portfolio.SOMETHING.workers.dev`.
3. Your dashboard will be at **`strava-dashboard.SOMETHING.workers.dev`**. Use your own `SOMETHING` everywhere below.

---

## Step 2: Create the Worker from GitHub (5 min)

1. Cloudflare → **Workers & Pages** → **Create** (top right).
2. Choose **Import a repository** (or the **Workers** tab → **Import a repository**).
3. Pick **GitHub**. If asked, click **Connect GitHub** and allow the *Cloudflare Workers and Pages* app to access **AdrianSchneider01/Test-code-**. Choosing "Only select repositories" is fine.
4. Select the **Test-code-** repository.
5. Fill in the setup page:
   | Field | Enter |
   |---|---|
   | Project name | `strava-dashboard` (must be exactly this) |
   | Production branch | `ccr-65eb6dcb-8s467i` |
   | Build command | leave empty |
   | Deploy command | `npx wrangler deploy` |
   | Root directory (under *Advanced settings*) | `strava-dashboard/cloudflare` |
6. Click **Create and deploy** (or **Deploy**). Wait 1–2 minutes for the build log to show **Success**.
7. Open `https://strava-dashboard.SOMETHING.workers.dev`. You should see **"Locked: Cloudflare Access is not configured for this Worker yet."** That's correct: it stays closed until Step 5.

---

## Step 3: Create the Strava API app (5 min)

1. Strava tab → https://www.strava.com/settings/api.
2. Fill in:
   | Field | Enter |
   |---|---|
   | Application Name | `Training Dashboard` |
   | Category | `Visualizer` |
   | Club | blank |
   | Website | `https://strava-dashboard.SOMETHING.workers.dev` |
   | Application Description | `Personal training dashboard` |
   | Authorization Callback Domain | `strava-dashboard.SOMETHING.workers.dev` (no `https://`, no `/`) |
3. Tick the agreement → **Create**. If asked for an icon, upload any small image.
4. Leave this page open. It shows your **Client ID** and **Client Secret** (click *show*).

---

## Step 4: Give the Worker your Strava keys (3 min)

1. Cloudflare → **Workers & Pages** → **strava-dashboard** → **Settings** tab → **Variables and Secrets** → **Add**.
2. Add the first entry:
   - Type **Text**, Variable name `STRAVA_CLIENT_ID`, Value = your Client ID. Click **Deploy** (or **Save**).
3. Click **Add** again:
   - Type **Secret**, Variable name `STRAVA_CLIENT_SECRET`, Value = your Client Secret. Click **Deploy**.

---

## Step 5: Lock it to you with Cloudflare Access (5 min)

1. Still in **strava-dashboard** → **Settings** → **Domains & Routes**.
2. On the `workers.dev` row, click **Enable Cloudflare Access** (or the **⋯** menu → *Enable Cloudflare Access*) and confirm.
3. Click **Manage Cloudflare Access**. The Zero Trust dashboard opens on the new application.
   - **Policies:** make sure there's an **Allow** policy whose **Include** is **Emails** = your email. Edit the default one if needed, then save.
   - **Overview** (or **Basic information**): copy the **Application Audience (AUD) Tag**.
4. Find your **team domain**: Zero Trust → **Settings** → **Custom Pages** (some accounts: **Settings → General**). It looks like `yourteam.cloudflareaccess.com`.
5. Back in **strava-dashboard** → **Settings** → **Variables and Secrets**, add three **Text** variables, clicking **Deploy** after each:
   | Variable name | Value |
   |---|---|
   | `ACCESS_TEAM_DOMAIN` | your team domain, e.g. `yourteam.cloudflareaccess.com` |
   | `ACCESS_AUD` | the AUD tag |
   | `ALLOWED_EMAILS` | your email |

---

## Step 6: Open it (2 min)

1. Open `https://strava-dashboard.SOMETHING.workers.dev` (a private window avoids old cached logins).
2. Cloudflare Access asks for your email. Enter the code it sends you.
3. Click **Connect Strava** → on Strava, keep *View data about your activities* ticked → **Authorize**.
4. Your activities load. Bookmark the page, then set your goal in ⚙︎ Settings: Half marathon, 23 Nov 2026.

---

## If something goes wrong

| You see | Fix |
|---|---|
| Build fails with a name error | The project name must be exactly `strava-dashboard`. |
| Build fails: can't find `wrangler.toml` | Root directory must be `strava-dashboard/cloudflare`, and the branch `ccr-65eb6dcb-8s467i`. |
| `Locked: Cloudflare Access is not configured` | Step 5's variables aren't saved yet. |
| `Forbidden` | The AUD or team domain doesn't match, or you signed in with another email. |
| Strava: `redirect_uri invalid` | The Strava Callback Domain doesn't exactly match the Worker's address. |
| "The Worker isn't fully set up yet" | `STRAVA_CLIENT_ID` or `STRAVA_CLIENT_SECRET` is missing (Step 4). |
