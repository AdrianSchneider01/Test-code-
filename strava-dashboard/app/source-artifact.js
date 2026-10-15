// Data source for the claude.ai artifact: Strava via the viewer's claude.ai connector (mcp capability),
// settings in the viewer's private db subtree (falls back to this browser).
import { fromRow } from "./dashboard.jsx";
import { COACH_INSTRUCTIONS, COACH_SCHEMA, isReview } from "./coach.js";

const STRAVA = "Strava"; // connector display name
const SETTINGS_KEY = "dash_settings_v1";

const claudeUse = name => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
function localGet(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function localSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// The owner's starting values, carried over from their original dashboard. Other viewers start blank.
const OWNER_DEFAULTS = {
  goal: { name:"Sydney Marathon", date:"2026-08-30", km:42.195, target:"" },
  weeklyRunKm: null,
  vo2: [
    {date:"2026-01-15",v:44.2},{date:"2026-02-15",v:46.1},{date:"2026-03-15",v:48.5},{date:"2026-04-15",v:49.3},
    {date:"2026-05-01",v:48.1},{date:"2026-05-15",v:46.8},{date:"2026-06-01",v:47.2},{date:"2026-06-10",v:47.8},{date:"2026-06-24",v:48.0},
  ],
};

function fromStrava(a) {
  const s = a.summary || {};
  return fromRow([a.id, a.name, a.sport_type, a.start_local, s.distance, s.moving_time, s.elevation_gain,
    s.relative_effort, s.total_calories, s.pr_count ?? s.achievement_count, s.avg_cadence, s.elapsed_time]);
}

async function callWithRetry(mcp, tool, input) {
  try { return await mcp.callTool(STRAVA, tool, input, { cache:false }); }
  catch (e) {
    if (!e?.retryable) throw e;
    await new Promise(r => setTimeout(r, Math.min(e.retryAfterMs ?? 0, 60000) || 1500 + Math.random()*1500));
    return await mcp.callTool(STRAVA, tool, input, { cache:false }); // retry at most once
  }
}

export const artifactSource = {
  async fetchActivities(rangeStart) {
    const mcp = await claudeUse("mcp");
    if (!mcp) throw { code:"no_mcp" };
    const out = [];
    let after = null;
    for (let page = 0; page < 3; page++) { // incremental syncs page through up to 300 new activities
      const input = { first:100, ...(rangeStart ? { range_start:rangeStart } : {}), ...(after ? { after } : {}) };
      const p = (await callWithRetry(mcp, "list_activities", input)).payload || {};
      (p.activities || []).forEach(a => a?.id && a?.start_local && out.push(fromStrava(a)));
      if (!rangeStart || !p.has_next_page || !p.end_cursor) break; // a full re-sync takes the latest 100
      after = p.end_cursor;
    }
    return out;
  },

  async fetchAthlete() {
    try {
      const mcp = await claudeUse("mcp");
      const p = mcp && (await mcp.callTool(STRAVA, "get_athlete_profile", {})).payload;
      return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : null;
    } catch { return null; }
  },

  async settingsStore() {
    const [db, user] = await Promise.all([claudeUse("db"), claudeUse("user")]);
    const id = user ? await user.id().catch(() => null) : null;
    const isOwner = user ? await user.isOwner().catch(() => false) : false;
    const ref = db && id ? db.collection(`data/users/${id}`).doc("settings") : null;
    return {
      defaults: isOwner ? OWNER_DEFAULTS : null,
      async load() {
        if (ref) { try { const snap = await ref.get(); if (snap.exists) return snap.data(); } catch {} }
        return localGet(SETTINGS_KEY);
      },
      async save(s) { localSet(SETTINGS_KEY, s); if (ref) await ref.set(s); },
    };
  },

  // AI session review through the viewer's own Claude (sample capability). Cached in this browser.
  async coachReview(activityId, context, refresh = false) {
    const key = `coach:${activityId}`;
    if (!refresh) { const c = localGet(key); if (c?.review) return c; }
    const sample = await claudeUse("sample");
    if (!sample) throw { code:"not_granted" };
    const prompt = `${COACH_INSTRUCTIONS}

Review this session. Reply with only a JSON object matching this JSON Schema:
${JSON.stringify(COACH_SCHEMA)}

Training data (JSON):
${JSON.stringify(context)}`;
    const review = await sample.json(prompt, { modelTier:"default", effort:"medium", cache: refresh ? { refresh:true } : true });
    if (!isReview(review)) throw { code:"invalid_json" };
    const out = { review, createdAt: Date.now() };
    localSet(key, out);
    return out;
  },

  coachErrorText(e) {
    switch (e?.code) {
      case "not_granted":
      case "sampling_disabled": return "The AI coach needs permission to use Claude on this page. Allow it from the page's Permissions menu.";
      case "rate_limited":
      case "usage_limit":       return "You've hit your Claude usage limit for now. Try again later.";
      case "invalid_json":      return "The coach's reply came back incomplete. Try again.";
      case "refused":           return "The coach declined to review this session.";
      default:                  return e?.message || "The coach couldn't review this session.";
    }
  },

  // Copy per connector error code (see the mcp capability's failure design).
  errorText(e) {
    switch (e?.code) {
      case "needs_reauth":         return { text:"Your Strava connection has expired. Reconnect Strava in claude.ai Settings → Connectors, then sync again.", retry:false };
      case "server_not_connected": return { text:"Strava isn't connected. Add the Strava connector in claude.ai Settings → Connectors, then sync again.", retry:false };
      case "selection_required":   return { text:"You have more than one Strava connector. Choose one when Claude asks, then sync again.", retry:true };
      case "not_in_manifest":
      case "consent_required":     return { text:"Strava access is turned off for this page. Allow it from the page's Permissions menu, then sync again.", retry:true };
      case "blocked_by_policy":    return { text:"Your organization's policy blocks Strava here.", retry:false };
      case "approval_required":    return { text:"Strava needs your approval for this page. Tap Sync and choose Allow.", retry:true };
      case "server_unavailable":   return { text:"Strava didn't respond. This is usually temporary, so try again in a minute.", retry:true };
      case "tool_error":           return { text:`Strava reported a problem: ${e.message}`, retry:true };
      case "no_mcp":               return { text:"Live Strava sync isn't available in this view. Open this page on claude.ai while signed in.", retry:false };
      default:                     return { text:e?.message || "Couldn't reach Strava.", retry:true };
    }
  },
};
