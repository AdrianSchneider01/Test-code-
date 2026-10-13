# Deploying the Strava dashboard to Cloudflare: step by step

About 20–30 minutes. Do the parts in order. You'll need a computer (not the phone apps) for Parts 1–3 and 5.

You set up access in Parts 1–3. Claude does the deploy in Part 4. You finish in Parts 5–6.

---

## Part 0: Find your workers.dev subdomain (2 min)

1. Go to https://dash.cloudflare.com and sign in.
2. In the left menu, click **Compute (Workers)** → **Workers & Pages**. On some accounts it's just **Workers & Pages**.
3. Click **portfolio**.
4. Near the top you'll see its address, like `portfolio.SOMETHING.workers.dev`.
5. Write down `SOMETHING`. The new dashboard will be at **`strava-dashboard.SOMETHING.workers.dev`**.

From here on, replace `SOMETHING` with your value.

---

## Part 1: Create a Strava API app (5 min)

1. Go to https://www.strava.com and sign in.
2. Go to https://www.strava.com/settings/api (or profile picture → **Settings** → **My API Application**).
3. Fill in the form:
   | Field | Enter |
   |---|---|
   | Application Name | `Training Dashboard` |
   | Category | `Visualizer` |
   | Club | leave blank |
   | Website | `https://strava-dashboard.SOMETHING.workers.dev` |
   | Application Description | `Personal training dashboard` |
   | Authorization Callback Domain | `strava-dashboard.SOMETHING.workers.dev` |

   For **Authorization Callback Domain**, enter the host name only: no `https://`, no `/` at the end.
4. Tick the API agreement box and click **Create**.
5. If Strava asks for an app icon, upload any small image (a screenshot works) and save.
6. You're now on the app's page. Keep this tab open, because you need two values in Part 3:
   - **Client ID**: a number, e.g. `123456`
   - **Client Secret**: click **show** to reveal it.

---

## Part 2: Create a Cloudflare API token (5 min)

This token is what lets Claude deploy for you.

1. Go to https://dash.cloudflare.com.
2. Top right: click the **person icon** → **My Profile**.
3. Left menu: **API Tokens**.
4. Click **Create Token**.
5. Find the template **Edit Cloudflare Workers** and click **Use template**.
6. Leave **Permissions** as they are.
7. Under **Account Resources**: **Include** → choose your account.
8. Under **Zone Resources**: **Include** → **All zones**.
9. Leave **Client IP Address Filtering** and **TTL** empty.
10. Click **Continue to summary** → **Create Token**.
11. **Copy the token now.** Cloudflare shows it only once. Keep it in this tab or a password manager until Part 3 is done.

---

## Part 3: Give Claude's cloud environment access (5 min)

Do this in the Claude app, in this session or any Claude Code cloud session that uses the same environment.

1. At the top of the session, click the **cloud environment name** in the title bar → **Edit**.
2. **Network access:**
   - Choose **Limited**. On older app versions it's called **Custom**.
   - Under **Allowed domains**, add `api.cloudflare.com`.
   - Leave **Allow package managers** ticked. On older app versions, tick **Include default list of package managers**.
3. **Network secrets** (called **API credentials** on older app versions; if neither exists, use **Environment variables**). Add three entries with exactly these names:
   | Name | Value |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | the token from Part 2 |
   | `STRAVA_CLIENT_ID` | the Client ID from Part 1 |
   | `STRAVA_CLIENT_SECRET` | the Client Secret from Part 1 |
4. Click **Save**.

Never paste these values into a chat message. They only go in these settings.

---

## Part 4: Ask Claude to deploy (5 min, mostly waiting)

1. Start a **new** Claude Code session in the same environment, with the `AdrianSchneider01/Test-code-` repository. Settings only apply to new sessions.
2. Paste this message:

   > Deploy the Strava dashboard to Cloudflare. It's in `strava-dashboard/cloudflare` on branch `ccr-65eb6dcb-8s467i` — follow `strava-dashboard/DEPLOY.md` Part 4. Use the CLOUDFLARE_API_TOKEN, STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET from the environment.

3. Claude will:
   - set `STRAVA_CLIENT_ID` in `wrangler.toml`;
   - run `npx wrangler deploy`;
   - set the Strava secret with `wrangler secret put STRAVA_CLIENT_SECRET`;
   - give you the live URL.
4. Check the URL matches what you put in Strava in Part 1 (`strava-dashboard.SOMETHING.workers.dev`). If not, edit the Strava app's Website and Callback Domain to match.

If you open the URL now, it says **"Locked: Cloudflare Access is not configured"**. That's expected and means it's safely closed.

> **For Claude (Part 4 details):** read the secrets from the environment, never echo them. If `wrangler` reports multiple accounts, get the account ID with the Cloudflare connector and set `CLOUDFLARE_ACCOUNT_ID`. Pipe the secret: `printf %s "$STRAVA_CLIENT_SECRET" | npx wrangler secret put STRAVA_CLIENT_SECRET`. Commit the `wrangler.toml` change to the branch.

---

## Part 5: Lock it to you with Cloudflare Access (5 min)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **strava-dashboard**.
2. Open the **Settings** tab → **Domains & Routes**.
3. On the `workers.dev` row, click **Enable Cloudflare Access** and confirm.
4. Click **Manage Cloudflare Access**. This opens the Zero Trust dashboard on the new Access application.
5. **Who can get in:**
   - Open the application's **Policies** and edit the default policy (or **Add a policy**).
   - Action: **Allow**. Include: **Emails** → your email address.
   - Save.
6. **Copy the Application Audience (AUD) tag:** in the application's **Overview** (or **Basic information**), copy the long string labelled **Application Audience (AUD) Tag**.
7. **Find your team domain:** Zero Trust dashboard → **Settings** → **Custom Pages** (on some accounts **Settings → General**). Copy the **Team domain**, like `yourteam.cloudflareaccess.com`. It's the same one your portfolio Worker uses.
8. Back in your Claude session, send:

   > Access is on. AUD is `<paste AUD>`, team domain is `<paste team domain>`, allowed email is `<your email>`. Update wrangler.toml and redeploy.

   These three values aren't secret, so pasting them in chat is fine.
9. Claude updates `wrangler.toml` and redeploys.

---

## Part 6: Use it (2 min)

1. In your laptop browser, open `https://strava-dashboard.SOMETHING.workers.dev`.
2. Cloudflare Access asks for your email and sends a code. Enter it.
3. The dashboard shows **Connect Strava**. Click it.
4. On Strava's page, leave **View data about your activities** ticked and click **Authorize**.
5. You're sent back and your history loads. Bookmark the page.

---

## If something goes wrong

| You see | Fix |
|---|---|
| Strava: `redirect_uri invalid` | The Strava app's **Authorization Callback Domain** doesn't exactly match the Worker's host name. Fix it at strava.com/settings/api (host name only). |
| `Locked: Cloudflare Access is not configured` | Part 5 isn't finished, or the redeploy in step 9 hasn't run yet. |
| `Forbidden` | The AUD or team domain is wrong, or you signed in to Access with a different email than `ALLOWED_EMAILS`. |
| "The Worker isn't fully set up yet" | The Strava Client ID or secret is missing. Ask Claude to re-run Part 4. |
| "Connect your Strava account" after it worked before | You revoked access on Strava or the login expired. Click **Connect Strava** again. |
| Claude says it can't reach `api.cloudflare.com` | Part 3 step 2 didn't save, or you're in an old session. Start a new session. |
