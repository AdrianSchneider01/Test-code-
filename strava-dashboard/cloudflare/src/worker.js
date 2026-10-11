// Strava training dashboard — Cloudflare Worker.
// Serves the bundled app from ./public, keeps Strava OAuth tokens, the activity history and settings in KV,
// and syncs Strava server-side so the browser never sees API credentials.
import { authorize } from "./access.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store",
};
const STRAVA_API = "https://www.strava.com/api/v3";
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // reuse the KV copy if Strava was checked this recently
const MAX_ROWS = 2000;
// Starting settings until you save your own (carried over from the original dashboard).
const DEFAULT_SETTINGS = {
  goal: { name: "Sydney Marathon", date: "2026-08-30", km: 42.195, target: "" },
  weeklyRunKm: null,
  vo2: [
    { date: "2026-01-15", v: 44.2 }, { date: "2026-02-15", v: 46.1 }, { date: "2026-03-15", v: 48.5 }, { date: "2026-04-15", v: 49.3 },
    { date: "2026-05-01", v: 48.1 }, { date: "2026-05-15", v: 46.8 }, { date: "2026-06-01", v: 47.2 }, { date: "2026-06-10", v: 47.8 }, { date: "2026-06-24", v: 48.0 },
  ],
};

class ApiError extends Error {
  constructor(code, status, message) { super(message || code); this.code = code; this.status = status; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const auth = await authorize(request, env, url);
    if (!auth.ok) return secure(new Response(auth.message, { status: auth.status }));
    try {
      if (url.pathname === "/auth/strava") return secure(await startOAuth(url, env));
      if (url.pathname === "/auth/strava/callback") return secure(await finishOAuth(url, env));
      if (url.pathname.startsWith("/api/")) return secure(await handleApi(request, env, url));
    } catch (e) {
      if (e instanceof ApiError) return secure(json({ error: e.code, message: e.message }, e.status));
      console.error(e);
      return secure(json({ error: "internal", message: "Internal error" }, 500));
    }
    return secure(await env.ASSETS.fetch(request));
  },
};

function secure(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
const kvGet = async (env, key, fallback) => (await env.STRAVA.get(key, "json")) ?? fallback;

// ── Strava OAuth ──────────────────────────────────────────────────────────────
function requireConfig(env) {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) throw new ApiError("not_configured", 503, "Strava client ID/secret not set");
}

async function startOAuth(url, env) {
  requireConfig(env);
  const state = crypto.randomUUID();
  await env.STRAVA.put(`oauth-state:${state}`, "1", { expirationTtl: 600 });
  const auth = new URL("https://www.strava.com/oauth/authorize");
  auth.search = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: `${url.origin}/auth/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });
  return Response.redirect(auth.toString(), 302);
}

async function finishOAuth(url, env) {
  requireConfig(env);
  const state = url.searchParams.get("state") || "";
  if (!state || !(await env.STRAVA.get(`oauth-state:${state}`))) return new Response("This sign-in link expired. Go back and press Connect Strava again.", { status: 400 });
  await env.STRAVA.delete(`oauth-state:${state}`);
  if (url.searchParams.get("error")) return Response.redirect(`${url.origin}/`, 302); // user pressed Cancel on Strava
  const scope = url.searchParams.get("scope") || "";
  if (!scope.includes("activity:read")) return new Response("Strava didn't grant access to your activities. Go back and allow \"View data about your activities\".", { status: 400 });
  const tok = await tokenRequest(env, { grant_type: "authorization_code", code: url.searchParams.get("code") || "" });
  const name = [tok.athlete?.firstname, tok.athlete?.lastname].filter(Boolean).join(" ");
  await env.STRAVA.put("token", JSON.stringify({ access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at }));
  if (name) await env.STRAVA.put("athlete", JSON.stringify(name));
  await env.STRAVA.delete("sync"); // force a full first sync
  return Response.redirect(`${url.origin}/`, 302);
}

async function tokenRequest(env, params) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params }),
  });
  if (res.status === 400 || res.status === 401) throw new ApiError("not_connected", 401, "Strava authorization is no longer valid");
  if (!res.ok) throw new ApiError("strava_error", 502, `Token request failed (${res.status})`);
  return res.json();
}

async function accessToken(env) {
  requireConfig(env);
  const tok = await kvGet(env, "token", null);
  if (!tok) throw new ApiError("not_connected", 401, "Strava isn't connected");
  if (tok.expires_at - 300 > Date.now() / 1000) return tok.access_token;
  try {
    const fresh = await tokenRequest(env, { grant_type: "refresh_token", refresh_token: tok.refresh_token });
    await env.STRAVA.put("token", JSON.stringify({ access_token: fresh.access_token, refresh_token: fresh.refresh_token, expires_at: fresh.expires_at }));
    return fresh.access_token;
  } catch (e) {
    if (e.code === "not_connected") await env.STRAVA.delete("token");
    throw e;
  }
}

async function strava(env, path) {
  const res = await fetch(`${STRAVA_API}${path}`, { headers: { Authorization: `Bearer ${await accessToken(env)}` } });
  if (res.status === 401) { await env.STRAVA.delete("token"); throw new ApiError("not_connected", 401, "Strava authorization was revoked"); }
  if (res.status === 429) throw new ApiError("rate_limited", 429, "Strava rate limit reached");
  if (!res.ok) throw new ApiError("strava_error", 502, `Strava returned ${res.status}`);
  return res.json();
}

// ── Activities ────────────────────────────────────────────────────────────────
// Compact row, same shape the app uses: [id, name, sport_type, start_local, distance_m, moving_time_s,
// elevation_gain_m, relative_effort, calories, pr_count, avg_cadence]
function toRow(a) {
  return [
    String(a.id), a.name, a.sport_type || a.type, String(a.start_date_local || "").replace(/Z$/, "").slice(0, 16),
    Math.round(a.distance || 0), a.moving_time || 0, Math.round((a.total_elevation_gain || 0) * 10) / 10,
    a.suffer_score ?? null,
    a.kilojoules != null ? Math.round(a.kilojoules) : null, // summaries carry no calories; ride kJ ≈ kcal
    a.pr_count ?? a.achievement_count ?? 0,
    a.average_cadence != null ? Math.round(a.average_cadence * 10) / 10 : null,
  ];
}

async function syncActivities(env, full) {
  const [rows, sync] = await Promise.all([kvGet(env, "rows", []), kvGet(env, "sync", null)]);
  if (!full && sync && rows.length && Date.now() - sync.at < SYNC_COOLDOWN_MS) return { rows, syncedAt: sync.at };

  // Incremental: everything since 2 days before the newest activity we hold (catches edits);
  // full / first sync: the latest 300.
  const newest = !full && rows.length ? rows.reduce((m, r) => (r[3] > m ? r[3] : m), "") : null;
  const after = newest ? Math.floor(new Date(`${newest.slice(0, 10)}T00:00:00Z`).getTime() / 1000) - 2 * 86400 : null;
  const fetched = [];
  for (let page = 1; page <= (after ? 10 : 3); page++) {
    const batch = await strava(env, `/athlete/activities?per_page=100&page=${page}${after ? `&after=${after}` : ""}`);
    batch.forEach(a => fetched.push(toRow(a)));
    if (batch.length < 100) break;
  }
  const byId = new Map((full ? [] : rows).map(r => [r[0], r]));
  fetched.forEach(r => byId.set(r[0], r));
  const merged = [...byId.values()].sort((a, b) => b[3].localeCompare(a[3])).slice(0, MAX_ROWS);
  const at = Date.now();
  await Promise.all([env.STRAVA.put("rows", JSON.stringify(merged)), env.STRAVA.put("sync", JSON.stringify({ at }))]);
  return { rows: merged, syncedAt: at };
}

// ── Settings ──────────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function sanitizeSettings(s) {
  if (!s || typeof s !== "object") throw new Error("Expected an object");
  const g = s.goal;
  const goal = g && typeof g === "object" && DATE_RE.test(g.date) && String(g.name || "").trim()
    ? { name: String(g.name).trim().slice(0, 80), date: g.date, km: Math.min(250, Math.max(1, +g.km || 42.195)), target: String(g.target || "").slice(0, 12) }
    : null;
  const weeklyRunKm = s.weeklyRunKm == null || s.weeklyRunKm === "" ? null : Math.min(500, Math.max(1, +s.weeklyRunKm || 1));
  const vo2 = (Array.isArray(s.vo2) ? s.vo2 : [])
    .filter(x => x && DATE_RE.test(x.date) && +x.v >= 10 && +x.v <= 100)
    .slice(0, 300).map(x => ({ date: x.date, v: Math.round(+x.v * 10) / 10 }));
  return { goal, weeklyRunKm, vo2 };
}

// ── API ───────────────────────────────────────────────────────────────────────
async function handleApi(request, env, url) {
  const route = `${request.method} ${url.pathname}`;
  if (route === "GET /api/activities") {
    const { rows, syncedAt } = await syncActivities(env, url.searchParams.get("full") === "1");
    return json({ rows, syncedAt, athlete: await kvGet(env, "athlete", null) });
  }
  if (route === "GET /api/settings") return json({ settings: await kvGet(env, "settings", DEFAULT_SETTINGS) });
  if (route === "PUT /api/settings") {
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "bad_request", message: "Expected JSON" }, 415);
    const body = await request.text();
    if (body.length > 50000) return json({ error: "bad_request", message: "Too large" }, 413);
    let settings;
    try { settings = sanitizeSettings(JSON.parse(body)); } catch (e) { return json({ error: "bad_request", message: e.message }, 400); }
    await env.STRAVA.put("settings", JSON.stringify(settings));
    return json({ settings });
  }
  if (route === "POST /api/disconnect") {
    await Promise.all(["token", "rows", "sync", "athlete"].map(k => env.STRAVA.delete(k)));
    return json({ ok: true });
  }
  return json({ error: "not_found", message: "Not found" }, 404);
}
