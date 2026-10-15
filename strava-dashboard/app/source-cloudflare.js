// Data source for the Cloudflare Worker: Strava via the Worker's own API (OAuth tokens live server-side),
// settings in the Worker's KV so they follow you across devices.
import { fromRow } from "./dashboard.jsx";

async function api(path, init) {
  let res;
  try { res = await fetch(path, { credentials:"same-origin", ...init }); }
  catch { throw { code:"offline" }; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: body.error || `http_${res.status}`, message: body.message, status: res.status };
  return body;
}

let athlete = null;

export const cloudflareSource = {
  // The Worker keeps the merged history in KV and syncs Strava incrementally itself.
  async fetchActivities(_rangeStart, full) {
    const body = await api(`/api/activities${full ? "?full=1" : ""}`);
    athlete = body.athlete || null;
    return (body.rows || []).map(fromRow);
  },

  async fetchAthlete() { return athlete; },

  async settingsStore() {
    return {
      defaults: null,
      async load() { return (await api("/api/settings")).settings || null; },
      async save(s) {
        await api("/api/settings", { method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(s) });
      },
    };
  },

  // AI session review (Claude, via the Worker). Cached server-side per activity.
  async coachReview(activityId, context, refresh = false) {
    const body = await api("/api/coach", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ activityId, context, refresh }) });
    return body; // { review, model, createdAt }
  },

  coachErrorText(e) {
    switch (e?.code) {
      case "coach_not_configured": return "The AI coach needs an Anthropic API key. Add ANTHROPIC_API_KEY as a secret in the Worker's Variables and Secrets.";
      case "coach_limit":          return "You've reached today's AI review limit. Reviews reset tomorrow.";
      case "coach_busy":           return "The coach is busy right now. Try again in a minute.";
      case "offline":              return "You appear to be offline.";
      default:                     return e?.message || "The coach couldn't review this session.";
    }
  },

  errorText(e) {
    switch (e?.code) {
      case "not_connected": return { text:"Connect your Strava account to load your activities.", retry:false, action:{ label:"Connect Strava", href:"/auth/strava" } };
      case "rate_limited":  return { text:"Strava's hourly limit was reached. Try again in about 15 minutes.", retry:true };
      case "strava_error":  return { text:`Strava reported a problem${e.message ? `: ${e.message}` : ""}.`, retry:true };
      case "not_configured":return { text:"The Worker isn't fully set up yet: add STRAVA_CLIENT_ID and the STRAVA_CLIENT_SECRET secret (see the README).", retry:false };
      case "offline":       return { text:"You appear to be offline.", retry:true };
      case "http_403":      return { text:"Your Cloudflare Access session has expired. Reload the page to sign in again.", retry:false };
      default:              return { text:e?.message || "Couldn't load activities.", retry:true };
    }
  },
};
