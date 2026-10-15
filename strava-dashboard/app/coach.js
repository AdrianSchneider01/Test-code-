// Coaching logic shared by both deployments: the training plan, per-session analysis,
// and the context + instructions sent to the AI coach.

const DAY = 86400000;
const parseLocal = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfDay = (d = new Date()) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const weekStart = (d = new Date()) => { const r = startOfDay(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const r1 = n => Math.round(n * 10) / 10;
const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const fmtPace = minPerKm => { if (!isFinite(minPerKm) || minPerKm <= 0) return "–"; const t = Math.round(minPerKm * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const fmtDur = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Training plan ─────────────────────────────────────────────────────────────
// Built backwards from race day: taper, peak long run three weeks out, a lighter week every fourth week.
function raceKind(km) { return km >= 40 ? "marathon" : km >= 20 ? "half" : km >= 9 ? "10k" : "5k"; }
const PACE_NAME = { marathon: "marathon pace", half: "half-marathon pace", "10k": "10K pace", "5k": "5K pace" };
const QUALITY = {
  marathon: ["3 × 1 km at marathon pace", "12 km with the middle 8 km at marathon pace", "2 × 5 km at marathon pace, 3 min jog", "6 × 1 km at 10K pace, 2 min jog", "3 × 3 km at half-marathon pace", "10 × 400 m at 5K pace"],
  half: ["3 × 1 km at half-marathon pace, 2 min jog", "8 km run with the middle 5 km at half-marathon pace", "2 × 4 km at half-marathon pace, 3 min jog", "6 × 800 m at 10K pace, 2 min jog", "3 × 2 km at half-marathon pace, 2 min jog", "5 km time trial"],
  "10k": ["4 × 1 km at 10K pace", "20 min tempo", "5 × 1 km at 10K pace, 90 s jog", "8 × 400 m at 5K pace", "3 × 2 km at 10K pace", "5 km time trial"],
  "5k": ["4 × 400 m at 5K pace", "3 × 1 km at 5K pace", "6 × 800 m at 5K pace", "20 min tempo", "10 × 400 m at 5K pace", "5 km time trial"],
};

export function buildPlan(goal, longestRecent = 12, today = new Date()) {
  if (!goal?.date) return null;
  const race = parseLocal(goal.date);
  const now = startOfDay(today);
  if (race < now) return null;
  const kind = raceKind(goal.km);
  const peak = kind === "marathon" ? 32 : kind === "half" ? 20 : kind === "10k" ? 14 : 10;
  const raceWeek = weekStart(race);
  const firstWeek = weekStart(now);
  const weeksOut = Math.round((raceWeek - firstWeek) / (7 * DAY));
  const weeks = [];
  for (let off = weeksOut; off >= 0; off--) {
    const start = addDays(raceWeek, -7 * off);
    let longKm, quality, note = "";
    if (off === 0) { longKm = goal.km; quality = "Race 🏁"; note = "Race week: two short easy runs with strides, then race."; }
    else if (off === 1) { longKm = Math.round(peak * (kind === "marathon" ? 0.5 : 0.25)); quality = QUALITY[kind][0]; note = "Taper: keep a little speed, drop the volume."; }
    else if (off === 2) { longKm = Math.round(peak * 0.75); quality = QUALITY[kind][1]; note = "Start of the taper."; }
    else if (off === 3) { longKm = peak; quality = QUALITY[kind][2]; note = "Peak week: the longest run of the plan."; }
    else {
      const step = off - 3; // weeks before peak
      // ~1 km/week toward the peak, never far beyond what you've run lately, and never below your current long run
      const floor = Math.min(longestRecent, peak * 0.7);
      const built = Math.max(floor, Math.min(peak - step, longestRecent + (weeksOut - off + 1) * 2));
      longKm = Math.max(6, Math.round(built));
      if (step % 4 === 1) { longKm = Math.round(longKm * 0.78); note = "Lighter week to absorb the training."; }
      quality = QUALITY[kind][3 + ((step - 1) % 3)];
      if (off === weeksOut && weeksOut >= 4) { quality = QUALITY[kind][5]; note = note || "Sets your training paces."; }
    }
    const targetKm = off === 0 ? Math.round(goal.km + 8) : off === 1 ? Math.round(longKm + 12) : Math.round(longKm + 18);
    weeks.push({ key: dateKey(start), start, end: addDays(start, 7), weeksOut: off, longKm, quality, targetKm, note,
      phase: off === 0 ? "Race" : off <= 2 ? "Taper" : off === 3 ? "Peak" : off <= 14 ? "Build" : "Base" });
  }
  return { kind, paceName: PACE_NAME[kind], peak, weeks, race: goal.date };
}

// Mark each plan week with what was actually done.
export function scorePlan(plan, runs) {
  if (!plan) return null;
  return {
    ...plan,
    weeks: plan.weeks.map(w => {
      const inWeek = runs.filter(a => { const d = parseLocal(a.date); return d >= w.start && d < w.end; });
      const km = inWeek.reduce((s, a) => s + a.km, 0);
      const long = inWeek.length ? Math.max(...inWeek.map(a => a.km)) : 0;
      return { ...w, doneKm: r1(km), doneLong: r1(long), runs: inWeek.length,
        longDone: long >= w.longKm * 0.9, qualityDone: inWeek.some(a => a._class?.type === "quality") };
    }),
  };
}

// ── Session analysis ──────────────────────────────────────────────────────────
// Baselines come from runs in the 8 weeks before the session.
function baselines(a, runs) {
  const d = parseLocal(a.date);
  const prior = runs.filter(r => r.id !== a.id && r.km >= 2 && parseLocal(r.date) < d && daysBetween(parseLocal(r.date), d) <= 56);
  const easy = prior.filter(r => r.km < 12);
  return {
    n: prior.length,
    pace: median(easy.map(r => r.min / r.km)),
    km: median(prior.map(r => r.km)),
    rePerKm: median(prior.filter(r => r.re != null).map(r => r.re / r.km)),
    cad: median(prior.filter(r => r.cad).map(r => r.cad * 2)),
    longest: prior.length ? Math.max(...prior.map(r => r.km)) : 0,
  };
}

export function classifyRun(a, runs) {
  const b = baselines(a, runs);
  const pace = a.km ? a.min / a.km : null;
  const stops = a.elapsed && a.min ? (a.elapsed - a.min) / a.min : 0;
  let type = "easy";
  if (b.km && a.km >= Math.max(12, b.km * 1.35)) type = "long";
  else if (b.pace && pace && (pace < b.pace - 0.3 || (stops > 0.2 && pace < b.pace - 0.1))) type = "quality";
  else if (b.km && a.km < b.km * 0.65) type = "recovery";
  return { type, pace, stops, base: b };
}

const TYPE_LABEL = { long: "Long run", quality: "Quality session", easy: "Easy run", recovery: "Short / recovery run", cross: "Cross-training" };

// Instant, rule-based read of a session. Works without the AI coach.
export function quickReview(a, acts, plan) {
  if (a.kind !== "run") {
    return { type: "cross", label: TYPE_LABEL.cross, verdict: "Supporting work",
      notes: [`${fmtDur(a.min)} of ${a.kind === "swim" ? "swimming" : a.kind === "ride" ? "riding" : "cross-training"}${a.re != null ? ` at Relative Effort ${a.re}` : ""}.`,
        (a.re ?? 0) > 80 ? "That's a solid aerobic load. Keep the next run easy." : "Low-impact aerobic work that adds fitness without stressing your legs."] };
  }
  const runs = acts.filter(r => r.kind === "run");
  const c = classifyRun(a, runs);
  const b = c.base, notes = [];
  if (b.pace && c.pace) {
    const diff = Math.round((c.pace - b.pace) * 60);
    notes.push(Math.abs(diff) < 6 ? `Pace ${fmtPace(c.pace)} /km, right on your usual easy pace.`
      : `Pace ${fmtPace(c.pace)} /km, ${Math.abs(diff)} s/km ${diff < 0 ? "faster" : "slower"} than your usual easy pace (${fmtPace(b.pace)}).`);
  }
  let verdict = "Solid session";
  if (a.re != null && b.rePerKm) {
    const ratio = (a.re / a.km) / b.rePerKm;
    if (ratio > 1.35) { notes.push(`Effort was high for the distance (RE ${a.re}, ${Math.round((ratio - 1) * 100)}% above your norm). Heat, fatigue or pace creep?`); verdict = c.type === "easy" ? "Easy run ran hard" : "Hard effort"; }
    else if (ratio < 0.8) { notes.push(`Very controlled: RE ${a.re} is ${Math.round((1 - ratio) * 100)}% below your usual effort per km. A sign of growing aerobic fitness.`); verdict = "Efficient and controlled"; }
  }
  if (c.type === "long") notes.push(a.km > b.longest ? `Longest run in 8 weeks (${r1(a.km)} km, previous ${r1(b.longest)} km). 💪` : `Long run of ${r1(a.km)} km.`);
  if (c.type === "quality" && c.stops > 0.2) notes.push(`About ${Math.round(c.stops * 100)}% of the session was recovery or standing, which looks like intervals.`);
  if (a.cad && b.cad && Math.abs(a.cad * 2 - b.cad) >= 3) notes.push(`Cadence ${Math.round(a.cad * 2)} spm (usual ${Math.round(b.cad)}).`);
  if (a.prs) notes.push(`🏆 ${a.prs} PR${a.prs > 1 ? "s" : ""} or achievements.`);
  const pw = plan?.weeks.find(w => { const d = parseLocal(a.date); return d >= w.start && d < w.end; });
  if (pw && c.type === "long") notes.push(a.km >= pw.longKm * 0.9 ? `Hit this week's planned long run (${pw.longKm} km). ✅` : `This week's plan calls for ${pw.longKm} km. ${r1(pw.longKm - a.km)} km short.`);
  return { type: c.type, label: TYPE_LABEL[c.type], verdict, notes, pace: c.pace, base: b };
}

// What the plan says to do next, from the day after `fromDate`.
export function nextPlanned(plan, fromDate) {
  if (!plan) return null;
  const d = addDays(parseLocal(fromDate), 1);
  const w = plan.weeks.find(x => d >= x.start && d < x.end) || plan.weeks.find(x => x.start > d);
  return w ? { week: w, text: `${w.quality}; long run ${w.longKm} km (${w.phase.toLowerCase()} week)` } : null;
}

// ── AI coach: context, instructions and output schema ─────────────────────────
export function buildCoachContext(a, acts, settings, fitness, plan) {
  const d = parseLocal(a.date);
  const runs = acts.filter(r => r.kind === "run");
  const q = quickReview(a, acts, plan);
  const recent = acts.filter(r => { const rd = parseLocal(r.date); return rd <= d && daysBetween(rd, d) <= 21; })
    .map(r => ({ date: r.date, day: DOW[parseLocal(r.date).getDay()], sport: r.kind, name: r.name, km: r1(r.km), time: fmtDur(r.min),
      pace: r.kind === "run" && r.km ? fmtPace(r.min / r.km) : undefined, elev_m: Math.round(r.elev), relative_effort: r.re }));
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(weekStart(d), -7 * i), we = addDays(ws, 7);
    const wr = runs.filter(r => { const rd = parseLocal(r.date); return rd >= ws && rd < we; });
    const other = acts.filter(r => r.kind !== "run" && parseLocal(r.date) >= ws && parseLocal(r.date) < we);
    weeks.push({ week_of: dateKey(ws), run_km: r1(wr.reduce((s, r) => s + r.km, 0)), runs: wr.length,
      long_run_km: wr.length ? r1(Math.max(...wr.map(r => r.km))) : 0, cross_training_min: Math.round(other.reduce((s, r) => s + r.min, 0)) });
  }
  const g = settings.goal;
  const pw = plan?.weeks.find(w => d >= w.start && d < w.end);
  const next = nextPlanned(plan, a.date);
  const vo2 = settings.vo2?.length ? settings.vo2[settings.vo2.length - 1] : null;
  return {
    today: dateKey(new Date()),
    session: {
      date: a.date, day: DOW[d.getDay()], start_time: a.time, sport: a.kind, name: a.name, distance_km: r1(a.km),
      moving_time: fmtDur(a.min), elapsed_time: a.elapsed ? fmtDur(a.elapsed) : undefined,
      pace_per_km: a.kind === "run" && a.km ? fmtPace(a.min / a.km) : undefined,
      elevation_m: Math.round(a.elev), relative_effort: a.re, cadence_spm: a.cad ? Math.round(a.cad * 2) : undefined,
      prs: a.prs, calories: a.cal ?? undefined,
      detected_type: q.label, quick_read: q.notes,
    },
    athlete_norms_last_8_weeks: a.kind === "run" ? {
      typical_easy_pace: q.base?.pace ? fmtPace(q.base.pace) : null, typical_run_km: q.base?.km ? r1(q.base.km) : null,
      typical_relative_effort_per_km: q.base?.rePerKm ? r1(q.base.rePerKm) : null, typical_cadence_spm: q.base?.cad ? Math.round(q.base.cad) : null,
      longest_run_km: q.base?.longest ? r1(q.base.longest) : null,
    } : undefined,
    goal: g ? { race: g.name, date: g.date, distance_km: g.km, target_time: g.target || null, days_to_go: daysBetween(new Date(), parseLocal(g.date)) } : null,
    plan_this_week: pw ? { phase: pw.phase, planned_long_run_km: pw.longKm, planned_quality: pw.quality, target_run_km: pw.targetKm, note: pw.note } : null,
    plan_next: next ? { week_of: next.week.key, phase: next.week.phase, planned_long_run_km: next.week.longKm, planned_quality: next.week.quality } : null,
    fitness_today: fitness ? { fitness_ctl: Math.round(fitness.ctl), fatigue_atl: Math.round(fitness.atl), form_tsb: Math.round(fitness.tsb), note: "CTL/ATL/TSB computed from Strava Relative Effort" } : null,
    vo2max_latest: vo2 ? { value: vo2.v, date: vo2.date } : null,
    weekly_history: weeks,
    last_21_days: recent,
  };
}

export const COACH_INSTRUCTIONS = `You are an experienced, certified running coach reviewing one training session for an amateur runner, using their Strava data.

Give feedback the way a good coach does after a session: specific, honest and encouraging, grounded in the numbers you were given. Compare the session with the athlete's own norms and recent weeks, and with what their plan called for. Think about what the session means for their goal race.

Guidelines:
- Use only the data provided. Do not invent heart rate, splits or anything not in the data. If something is unknown, don't guess.
- Relative Effort is Strava's heart-rate-based load score. A high value per km at an easy pace suggests fatigue, heat or running too fast.
- Most running should be easy (roughly 80/20). Flag easy runs run too hard, sudden jumps in weekly volume (>10–15%), and missing long runs.
- Recommend the next session concretely: day, distance or duration, and pace or effort (pace in min/km, effort in plain words). Fit it to the plan and the athlete's current form and fatigue.
- Keep it short and readable on a phone. Plain words, no jargon without explanation. Write in Australian English.
- Safety: for any sign of injury or illness, recommend rest and seeing a professional. Never give medical diagnoses.`;

export const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "rating", "summary", "went_well", "watch_outs", "next_session", "week_focus"],
  properties: {
    headline: { type: "string", description: "One short sentence verdict on the session (max ~12 words)." },
    rating: { type: "string", enum: ["great", "on_target", "harder_than_ideal", "easier_than_planned", "caution"] },
    summary: { type: "string", description: "2–3 sentences: what this session was and what it means for the goal." },
    went_well: { type: "array", items: { type: "string" }, description: "1–3 specific positives." },
    watch_outs: { type: "array", items: { type: "string" }, description: "0–3 specific things to adjust." },
    next_session: {
      type: "object", additionalProperties: false, required: ["when", "session", "why"],
      properties: { when: { type: "string" }, session: { type: "string" }, why: { type: "string" } },
    },
    week_focus: { type: "string", description: "One sentence on the priority for the rest of this week." },
  },
};

// Basic shape check for reviews coming back from either backend.
export function isReview(x) {
  return x && typeof x.headline === "string" && typeof x.summary === "string" && Array.isArray(x.went_well)
    && Array.isArray(x.watch_outs) && x.next_session && typeof x.next_session.session === "string";
}
