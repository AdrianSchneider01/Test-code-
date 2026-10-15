import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  ReferenceLine, Area, AreaChart, LineChart, Line,
} from "recharts";
import { buildPlan, scorePlan, classifyRun, quickReview, buildCoachContext, nextPlanned } from "./coach.js";

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG = "#000", CARD = "#1c1c1e", CARD2 = "#2c2c2e", SEP = "#2c2c2e", TEXT = "#fff", MUTED = "#8e8e93";
const BLUE = "#4a9eff", ORANGE = "#f4511e", TEAL = "#2dd4bf", GRAY = "#a1a1aa", GREEN = "#4ade80", RED = "#f87171", AMBER = "#f59e0b", PURPLE = "#a78bfa";
const KINDS = ["run", "ride", "swim", "other"];
const KIND = {
  run:   { label:"Run",   icon:"🏃", color:BLUE,   heat:["#1a3a5c","#1e6ba8","#2196f3","#4a9eff"] },
  ride:  { label:"Ride",  icon:"🚴", color:ORANGE, heat:["#3d1f0a","#8b3a0f","#c94b1a","#f4511e"] },
  swim:  { label:"Swim",  icon:"🏊", color:TEAL,   heat:["#0f3b37","#11695f","#14b8a6","#2dd4bf"] },
  other: { label:"Other", icon:"💪", color:GRAY,   heat:["#2a2a2e","#3f3f46","#71717a","#a1a1aa"] },
};
const CACHE_KEY = "strava_cache_v1";   // localStorage: { acts:[...normalized], athlete, ts }
const SETTINGS_KEY = "dash_settings_v1";
const CACHE_TTL = 30 * 60 * 1000;
const REDUCE_MOTION = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const DEFAULT_SETTINGS = { goal:null, weeklyRunKm:null, vo2:[] }; // weeklyRunKm null = auto from 4-week average

// ── Date helpers (all local time; "YYYY-MM-DD" strings are local dates) ──────
const DAY = 86400000;
function parseLocal(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfDay(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function getWeekStart(d = new Date()) { const r = startOfDay(d); const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r; }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }
const fmtDay  = s => parseLocal(s).toLocaleDateString("en-AU",{day:"numeric",month:"short"});
const fmtDayW = s => parseLocal(s).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});
const fmtDayLong = s => parseLocal(s).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtDur(min) { const h = Math.floor(min/60), m = Math.round(min%60); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; }
function fmtClock(min) { const t = Math.round(min*60), h = Math.floor(t/3600), m = Math.floor(t%3600/60), s = t%60; return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
function fmtPace(minPerUnit) { if (!isFinite(minPerUnit) || minPerUnit <= 0) return "–"; const t = Math.round(minPerUnit*60); return `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`; }
function fmtDist(a) { return a.kind === "swim" ? `${Math.round(a.km*1000).toLocaleString()} m` : `${a.km.toFixed(1)} km`; }
function fmtSpeed(a) {
  if (!a.km || !a.min) return "";
  if (a.kind === "ride") return `${(a.km/(a.min/60)).toFixed(1)} km/h`;
  if (a.kind === "swim") return `${fmtPace(a.min/(a.km*10))} /100m`;
  return `${fmtPace(a.min/a.km)} /km`;
}
function relTime(ts) {
  if (!ts) return "never";
  const s = Math.round((Date.now()-ts)/1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s/60)}m ago`;
  if (s < 86400) return `${Math.round(s/3600)}h ago`;
  return `${Math.round(s/86400)}d ago`;
}
function parseTargetTime(s) { // "3:45", "3:45:00" → minutes
  const p = (s||"").trim().split(":").map(Number);
  if (!p.length || p.some(n => !isFinite(n))) return null;
  if (p.length === 3) return p[0]*60 + p[1] + p[2]/60;
  if (p.length === 2) return p[0]*60 + p[1];
  return null;
}
const r1 = n => Math.round(n*10)/10;
const sumBy = (arr, f) => arr.reduce((s,a)=>s+f(a),0);

// ── Activities ────────────────────────────────────────────────────────────────
function kindOf(type = "") {
  if (/run/i.test(type)) return "run";
  if (/ride|cycl|bike/i.test(type)) return "ride";
  if (/swim/i.test(type)) return "swim";
  return "other";
}
// Compact row: [id, name, sport_type, start_local, distance_m, moving_time_s, elevation_gain_m, relative_effort, calories, pr_count, avg_cadence, elapsed_time_s]
export function fromRow(r) {
  const [id, name, type, start, m, s, elev, re, cal, prs, cad, el] = r;
  return {
    id:String(id), name:name||type, type, kind:kindOf(type),
    date:String(start).slice(0,10), time:String(start).slice(11,16),
    km:(+m||0)/1000, min:(+s||0)/60, elev:+elev||0,
    re: re == null ? null : +re, cal: cal == null ? null : +cal, prs:+prs||0, cad: cad == null ? null : +cad,
    elapsed: el == null ? null : +el/60,
  };
}
// Strava's relative effort is missing on some activities; estimate from duration so load charts don't dip to zero.
const LOAD_PER_MIN = { run:1.2, ride:0.5, swim:1.0, other:0.4 };
const loadOf = a => a.re ?? Math.round(a.min * LOAD_PER_MIN[a.kind]);

function mergeActs(...lists) {
  const map = new Map();
  lists.flat().forEach(a => map.set(a.id, a));
  return [...map.values()].sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
}

// ── Core computations ─────────────────────────────────────────────────────────
function emptySums() { return Object.fromEntries(KINDS.map(k => [k, { km:0, min:0, elev:0, load:0, n:0 }])); }
function addTo(sums, a) { const s = sums[a.kind]; s.km += a.km; s.min += a.min; s.elev += a.elev; s.load += loadOf(a); s.n++; }

function computeDashboard(acts, settings) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = getWeekStart(now);
  const withD = acts.map(a => ({ ...a, _d: parseLocal(a.date) }));
  const inRange = (from, to) => withD.filter(a => a._d >= from && a._d < to);
  const kinds = KINDS.filter(k => acts.some(a => a.kind === k));

  // Weeks (12, Mon–Sun) and months (6)
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const start = addDays(weekStart, -w*7), end = addDays(start, 7);
    const items = inRange(start, end), sums = emptySums();
    items.forEach(a => addTo(sums, a));
    const runs = items.filter(a => a.kind === "run");
    weeks.push({ key:dateKey(start), label:start.toLocaleDateString("en-AU",{day:"numeric",month:"short"}), title:`Week of ${fmtDay(dateKey(start))}`, items, sums,
      longRun: runs.length ? Math.max(...runs.map(a=>a.km)) : 0 });
  }
  const months = [];
  for (let m = 5; m >= 0; m--) {
    const start = new Date(now.getFullYear(), now.getMonth()-m, 1), end = new Date(now.getFullYear(), now.getMonth()-m+1, 1);
    const items = inRange(start, end), sums = emptySums();
    items.forEach(a => addTo(sums, a));
    months.push({ key:dateKey(start), label:start.toLocaleDateString("en-AU",{month:"short"}), title:start.toLocaleDateString("en-AU",{month:"long",year:"numeric"}), items, sums });
  }
  const thisWeek = weeks[11];
  const prev4 = weeks.slice(7, 11);
  const avg4Run = sumBy(prev4, w => w.sums.run.km) / 4;
  const weeklyTarget = settings.weeklyRunKm || Math.max(10, Math.ceil(avg4Run/5)*5);

  // Month to date vs same span last month (clamped to last month's length)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevEnd = new Date(now.getFullYear(), now.getMonth()-1, Math.min(now.getDate(), prevDays)+1);
  const monKm = r1(sumBy(inRange(monthStart, tomorrow), a=>a.km));
  const prevKm = r1(sumBy(inRange(prevStart, prevEnd), a=>a.km));

  // Streak
  const activeDays = new Set(acts.map(a=>a.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) { if (activeDays.has(dateKey(addDays(today,-i)))) streak++; else if (i > 0) break; }

  // Calendar (12 Monday-aligned weeks)
  const byDate = new Map();
  acts.forEach(a => { if (!byDate.has(a.date)) byDate.set(a.date, []); byDate.get(a.date).push(a); });
  const calDays = [];
  for (let d = addDays(weekStart, -77); d <= today; d = addDays(d, 1)) {
    const ds = dateKey(d), da = byDate.get(ds) || [];
    const load = sumBy(da, loadOf);
    const top = da.length ? da.reduce((m,a) => loadOf(a) > loadOf(m) ? a : m) : null;
    calDays.push({ date:ds, day:d.getDay(), week:Math.round((weekStart - getWeekStart(d)) / (7*DAY)),
      v: load>150?4 : load>90?3 : load>40?2 : da.length?1:0, kind: top?.kind || null, acts:da, load });
  }

  // Fitness (CTL, 42d) / Fatigue (ATL, 7d) / Form (TSB) from daily load
  const series = [];
  if (acts.length) {
    const daily = new Map();
    acts.forEach(a => daily.set(a.date, (daily.get(a.date)||0) + loadOf(a)));
    let ctl = 0, atl = 0;
    for (let d = parseLocal(acts[acts.length-1].date); d <= today; d = addDays(d,1)) {
      const L = daily.get(dateKey(d)) || 0;
      const form = ctl - atl; // form uses yesterday's fitness/fatigue
      ctl += (L-ctl)/42; atl += (L-atl)/7;
      series.push({ date:dateKey(d), label:fmtDay(dateKey(d)), load:L, ctl:r1(ctl), atl:r1(atl), tsb:r1(form) });
    }
  }
  const cur = series[series.length-1] || { ctl:0, atl:0, tsb:0 };
  const ctl28 = series[series.length-29]?.ctl ?? 0;
  const form = formStatus(cur.tsb);

  // Running
  const runs = acts.filter(a => a.kind === "run" && a.km >= 1);
  const recentRuns = runs.filter(a => daysBetween(parseLocal(a.date), today) <= 112).slice().reverse();
  const pace = recentRuns.filter(a => a.km >= 2).map((a, i, arr) => {
    const win = arr.slice(Math.max(0, i-4), i+1);
    return { label:fmtDay(a.date), pace:+(a.min/a.km).toFixed(2), avg:+(sumBy(win,x=>x.min)/sumBy(win,x=>x.km)).toFixed(2), km:r1(a.km) };
  });
  const pv = pace.flatMap(p => [p.pace, p.avg]);
  const pLo = pv.length ? Math.floor(Math.min(...pv)*2)/2 : 5, pHi = pv.length ? Math.ceil(Math.max(...pv)*2)/2 : 7;
  const paceTicks = []; for (let t = pLo; t <= pHi + 1e-9; t += 0.5) paceTicks.push(t);
  const longest = runs.reduce((m,a) => !m || a.km > m.km ? a : m, null);
  const fastest = runs.filter(a => a.km >= 5).reduce((m,a) => !m || a.min/a.km < m.min/m.km ? a : m, null);
  const bigWeek = weeks.reduce((m,w) => w.sums.run.km > (m?.sums.run.km||0) ? w : m, null);
  const cadRuns = runs.filter(a => a.cad).slice(0, 10);
  const cadence = cadRuns.length ? Math.round(sumBy(cadRuns, a=>a.cad)/cadRuns.length*2) : null;
  const lastRun = runs[0] || null;

  // Goal race
  const g = settings.goal;
  const goalDays = g?.date ? daysBetween(today, parseLocal(g.date)) : null;
  const peakLong = !g ? 0 : g.km >= 40 ? 32 : g.km >= 21 ? 19 : g.km;
  const long4 = Math.max(0, ...weeks.slice(8).map(w => w.longRun));
  const raceResult = g && goalDays < 0
    ? runs.find(a => Math.abs(daysBetween(parseLocal(a.date), parseLocal(g.date))) <= 1 && a.km >= g.km*0.9) || null
    : null;

  const insights = buildInsights({ weeks, avg4Run, today, lastRun, runs, form, thisWeek });

  return { kinds, weeks, months, thisWeek, avg4Run, weeklyTarget, monKm, prevKm, streak, calDays, series, cur, ctl28, form,
    pace, paceTicks, longest, fastest, bigWeek, cadence, goalDays, peakLong, long4, raceResult, insights, total:acts.length };
}

function formStatus(tsb) {
  if (tsb > 5)   return { label:"Fresh",        color:GREEN,  text:"Well rested — a good day for a quality session or race." };
  if (tsb > -10) return { label:"Neutral",      color:"#d4d4d8", text:"Load and recovery are balanced. You're maintaining fitness." };
  if (tsb > -30) return { label:"Productive",   color:BLUE,   text:"Carrying fatigue that builds fitness. Keep easy days easy." };
  return              { label:"Overreaching", color:RED,    text:"Fatigue is high. Prioritise sleep and an easy or rest day." };
}

function buildInsights({ weeks, avg4Run, today, lastRun, runs, form, thisWeek }) {
  const out = [];
  const lastWeek = weeks[10], lw = lastWeek.sums.run.km;
  if (avg4Run > 0 && lw > 0) {
    const ch = (lw - avg4Run) / avg4Run, pct = Math.round(Math.abs(ch)*100);
    if (ch > 0.15) out.push({ icon:"⚠️", tone:AMBER, text:`Last week's running (${r1(lw)} km) was ${pct}% above your 4-week average. Keep weekly jumps around 10–15% to stay injury-free.` });
    else if (ch < -0.3) out.push({ icon:"🛌", tone:MUTED, text:`Last week was ${pct}% lighter than usual (${r1(lw)} km). Great if it was a planned recovery week.` });
    else out.push({ icon:"✅", tone:GREEN, text:`Steady load — last week's ${r1(lw)} km is within ${pct}% of your 4-week average.` });
  }
  if (lastRun) {
    const gap = daysBetween(parseLocal(lastRun.date), today);
    if (gap >= 4) out.push({ icon:"⏰", tone:AMBER, text:`${gap} days since your last run. A short easy run keeps the habit alive.` });
  }
  const two = runs.filter(a => daysBetween(parseLocal(a.date), today) < 14);
  const hard = two.filter(a => (a.re||0) > 100).length;
  if (two.length >= 3 && hard/two.length > 0.5) out.push({ icon:"🎚️", tone:AMBER, text:`${hard} of your last ${two.length} runs were hard efforts. Aim for ~80% easy running to build aerobic base.` });
  const prs = sumBy(thisWeek.items, a => a.prs);
  if (prs > 0) out.push({ icon:"🏆", tone:AMBER, text:`${prs} PRs and achievements this week. Nice work!` });
  const cross = thisWeek.sums.ride.min + thisWeek.sums.swim.min;
  if (cross >= 60) out.push({ icon:"🔄", tone:PURPLE, text:`${fmtDur(cross)} of cross-training this week — great low-impact aerobic work.` });
  out.push({ icon:"📈", tone:form.color, text:`Form: ${form.label}. ${form.text}` });
  return out.slice(0, 4);
}

// ── Local cache ───────────────────────────────────────────────────────────────
// Per-browser convenience so the page opens instantly; the data source stays the source of truth.
function localGet(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function localSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── Small UI pieces ───────────────────────────────────────────────────────────
const label = { margin:"0 0 12px", fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600 };
const card = { background:CARD, borderRadius:14, padding:"16px 18px", border:`1px solid ${SEP}` };
const btn = { background:CARD2, border:"none", borderRadius:8, color:TEXT, cursor:"pointer", fontSize:12, fontWeight:600, padding:"8px 12px", fontFamily:"inherit" };
const input = { width:"100%", boxSizing:"border-box", background:"#111", border:`1px solid #3a3a3c`, borderRadius:8, color:TEXT, padding:"10px 12px", fontSize:14, fontFamily:"inherit" };
const tooltipStyle = { contentStyle:{ background:CARD2, border:"none", borderRadius:8, color:TEXT, fontSize:12 }, labelStyle:{ color:MUTED }, cursor:{ fill:"rgba(255,255,255,0.05)" } };

function Segmented({ options, active, onSelect, style = {}, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ display:"flex", background:CARD2, borderRadius:8, padding:2, ...style }}>
      {options.map(o => (
        <button key={o} role="tab" aria-selected={active===o} onClick={()=>onSelect(o)}
          style={{ flex:1, padding:"7px 0", fontSize:12, fontWeight:600, background:active===o?"#fff":"transparent", color:active===o?"#000":MUTED, border:"none", borderRadius:6, cursor:"pointer", fontFamily:"inherit" }}>{o}</button>
      ))}
    </div>
  );
}

function Stat({ label: l, value, sub, color = TEXT, subColor = MUTED }) {
  return (
    <div style={card}>
      <p style={{ margin:"0 0 8px", fontSize:11, color:MUTED }}>{l}</p>
      <p style={{ margin:0, fontSize:24, fontWeight:800, color, letterSpacing:"-0.03em", lineHeight:1.1 }}>{value}</p>
      {sub && <p style={{ margin:"6px 0 0", fontSize:11, color:subColor, lineHeight:1.35 }}>{sub}</p>}
    </div>
  );
}

function Ring({ pct, size = 108, stroke = 10, color = BLUE, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(1, Math.max(0, pct));
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={CARD2} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct >= 1 ? GREEN : color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c*(1-p)} style={{ transition: REDUCE_MOTION ? "none" : "stroke-dashoffset 0.8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>{children}</div>
    </div>
  );
}

function Bar100({ pct, color }) {
  return (
    <div style={{ height:6, background:CARD2, borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(100, Math.max(0, pct*100))}%`, height:"100%", background:color, borderRadius:3 }}/>
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:50 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:CARD, width:"100%", maxWidth:560, maxHeight:"88vh", overflowY:"auto", borderRadius:"18px 18px 0 0", padding:"10px 20px 28px", border:`1px solid ${SEP}`, boxSizing:"border-box" }}>
        <div style={{ width:36, height:4, background:"#48484a", borderRadius:2, margin:"0 auto 14px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:12 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{title}</h2>
          <button aria-label="Close" onClick={onClose} style={{ ...btn, padding:"6px 10px", fontSize:14 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActivityRow({ a, onOpen }) {
  const k = KIND[a.kind];
  return (
    <button onClick={()=>onOpen(a)} aria-label={`${a.name}, ${fmtDist(a)}, ${fmtDayW(a.date)}`}
      style={{ ...card, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, width:"100%", textAlign:"left", cursor:"pointer", color:TEXT, fontFamily:"inherit" }}>
      <div style={{ width:40, height:40, borderRadius:10, background:`${k.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{k.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <p style={{ margin:0, fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name}</p>
          {a.prs > 0 && <span style={{ fontSize:10, color:AMBER, background:`${AMBER}1f`, padding:"1px 6px", borderRadius:6, flexShrink:0 }}>🏆 {a.prs}</span>}
        </div>
        <p style={{ margin:"2px 0 0", fontSize:12, color:MUTED }}>{fmtDayW(a.date)} · {fmtDur(a.min)}{fmtSpeed(a) && ` · ${fmtSpeed(a)}`}</p>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <p style={{ margin:0, fontSize:16, fontWeight:800 }}>{fmtDist(a)}</p>
        {a.re != null && <p style={{ margin:"2px 0 0", fontSize:11, color:a.re>100?ORANGE:MUTED }}>RE {a.re}</p>}
      </div>
    </button>
  );
}

function ActivityDetail({ a, onClose }) {
  const k = KIND[a.kind];
  const stats = [
    ["Distance", fmtDist(a)], ["Moving time", fmtDur(a.min)],
    [a.kind==="ride" ? "Avg speed" : "Avg pace", fmtSpeed(a) || "–"], ["Elevation", `${Math.round(a.elev)} m`],
    ["Relative effort", a.re ?? "–"], ["Calories", a.cal != null ? a.cal.toLocaleString() : "–"],
  ];
  if (a.kind === "run" && a.cad) stats.push(["Cadence", `${Math.round(a.cad*2)} spm`]);
  if (a.prs) stats.push(["PRs / achievements", `🏆 ${a.prs}`]);
  return (
    <Sheet title={`${k.icon} ${a.name}`} onClose={onClose}>
      <p style={{ margin:"-8px 0 16px", fontSize:13, color:MUTED }}>{fmtDayLong(a.date)}{a.time && ` · ${a.time}`}</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
        {stats.map(([l,v]) => (
          <div key={l} style={{ background:"#111", borderRadius:10, padding:"12px 14px" }}>
            <p style={{ margin:"0 0 4px", fontSize:11, color:MUTED }}>{l}</p>
            <p style={{ margin:0, fontSize:18, fontWeight:700 }}>{v}</p>
          </div>
        ))}
      </div>
      <a href={`https://www.strava.com/activities/${a.id}`} target="_blank" rel="noopener noreferrer"
        style={{ display:"block", textAlign:"center", background:ORANGE, color:"#fff", borderRadius:10, padding:"12px", fontWeight:700, fontSize:14, textDecoration:"none" }}>
        Open in Strava ↗
      </a>
    </Sheet>
  );
}

function SettingsSheet({ settings, auto, onSave, onClose, onResync, syncing }) {
  const [goal, setGoal] = useState({ name:"", date:"", km:42.195, target:"", ...(settings.goal || {}) });
  const [weekly, setWeekly] = useState(settings.weeklyRunKm ?? "");
  const [vo2, setVo2] = useState(settings.vo2);
  const [vDate, setVDate] = useState(dateKey(new Date()));
  const [vVal, setVVal] = useState("");
  const targetOk = !goal.target || parseTargetTime(goal.target) != null;
  const goalOk = !goal.name.trim() === !goal.date; // both filled in, or both blank (no goal)
  const save = () => {
    if (!targetOk || !goalOk) return;
    const g = goal.name.trim() && goal.date ? { name:goal.name.trim(), date:goal.date, km:+goal.km || 42.195, target:goal.target.trim() } : null;
    onSave({ goal:g, weeklyRunKm: weekly === "" ? null : Math.max(1, +weekly), vo2 });
    onClose();
  };
  const field = (lbl, el) => <label style={{ display:"block", marginBottom:12 }}><span style={{ display:"block", fontSize:12, color:MUTED, marginBottom:6 }}>{lbl}</span>{el}</label>;
  return (
    <Sheet title="Settings" onClose={onClose}>
      <p style={label}>Goal race</p>
      {field("Race name", <input id="goal-name" style={input} placeholder="e.g. Melbourne Marathon" value={goal.name} onChange={e=>setGoal({ ...goal, name:e.target.value })}/>)}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {field("Date", <input type="date" style={input} value={goal.date} onChange={e=>setGoal({ ...goal, date:e.target.value })}/>)}
        {field("Distance", (
          <select style={input} value={String(goal.km)} onChange={e=>setGoal({ ...goal, km:+e.target.value })}>
            {[["5","5K"],["10","10K"],["21.0975","Half marathon"],["42.195","Marathon"],["50","50K"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>
      {field("Target time (h:mm:ss, optional)", <input style={{ ...input, borderColor:targetOk?"#3a3a3c":RED }} placeholder="e.g. 3:59:00" value={goal.target} onChange={e=>setGoal({ ...goal, target:e.target.value })}/>)}

      <p style={{ ...label, marginTop:20 }}>Weekly running target</p>
      {field(`km per week (blank = auto, currently ${auto} km)`, <input type="number" min="1" inputMode="decimal" style={input} value={weekly} onChange={e=>setWeekly(e.target.value)}/>)}

      <p style={{ ...label, marginTop:20 }}>VO₂ max readings (from your watch)</p>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <input type="date" aria-label="Reading date" style={{ ...input, flex:1 }} value={vDate} onChange={e=>setVDate(e.target.value)}/>
        <input type="number" aria-label="VO₂ max value" step="0.1" inputMode="decimal" placeholder="48.0" style={{ ...input, width:90 }} value={vVal} onChange={e=>setVVal(e.target.value)}/>
        <button style={{ ...btn, background:BLUE }} onClick={()=>{ if (+vVal > 0 && vDate) { setVo2([...vo2.filter(x=>x.date!==vDate), { date:vDate, v:+vVal }].sort((a,b)=>a.date.localeCompare(b.date))); setVVal(""); } }}>Add</button>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20 }}>
        {vo2.slice().reverse().map(x => (
          <span key={x.date} style={{ background:CARD2, borderRadius:16, padding:"4px 6px 4px 10px", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            {fmtDay(x.date)} · {x.v}
            <button aria-label={`Remove reading ${x.date}`} onClick={()=>setVo2(vo2.filter(y=>y.date!==x.date))} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:13 }}>✕</button>
          </span>
        ))}
      </div>

      {!goalOk && <p style={{ margin:"0 0 10px", fontSize:12, color:RED }}>Add both a race name and a date, or clear both to remove the goal.</p>}
      <button onClick={save} disabled={!targetOk || !goalOk} style={{ ...btn, width:"100%", padding:12, fontSize:14, background:ORANGE, marginBottom:10, opacity:targetOk && goalOk ? 1 : 0.5 }}>Save</button>
      <button onClick={()=>{ onResync(); onClose(); }} disabled={syncing} style={{ ...btn, width:"100%", padding:12, fontSize:13 }}>↻ Full re-sync from Strava (last 100)</button>
    </Sheet>
  );
}

function CalendarHeatmap({ days, kinds }) {
  const [sel, setSel] = useState(null);
  const WEEKS = 12, cs = 14, gap = 3;
  const heat = (v, kind) => v ? KIND[kind].heat[v-1] : "#262628";
  const active = days.filter(d => d.v).length;
  return (
    <div style={{ ...card, padding:"18px", marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:8, flexWrap:"wrap" }}>
        <p style={{ ...label, margin:0 }}>Last 12 weeks · {active} active days</p>
        <div style={{ display:"flex", gap:10 }}>
          {kinds.map(k => (
            <span key={k} style={{ fontSize:10, color:MUTED, display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:KIND[k].color }}/>{KIND[k].label}
            </span>
          ))}
        </div>
      </div>
      {/* One grid (column flow) so day labels and cells always share the same rows */}
      <div style={{ display:"grid", gridTemplateRows:`repeat(7, ${cs}px)`, gridAutoFlow:"column", gridTemplateColumns:`12px repeat(${WEEKS}, ${cs}px)`, gap, justifyContent:"space-between", maxWidth:WEEKS*(cs+10) }}>
        {["M","T","W","T","F","S","S"].map((l,i)=>(
          <div key={`l${i}`} style={{ fontSize:9, color:MUTED, display:"flex", alignItems:"center", opacity:i%2===0?1:0 }}>{l}</div>
        ))}
        {Array.from({ length:WEEKS }).flatMap((_,wi) => [1,2,3,4,5,6,0].map(dow => {
          const cell = days.find(d => d.week===(WEEKS-1-wi) && d.day===dow);
          if (!cell) return <div key={`${wi}-${dow}`}/>;
          const on = sel?.date === cell.date;
          return <button key={cell.date} aria-label={`${fmtDayW(cell.date)}: ${cell.acts.length ? cell.acts.map(a=>`${KIND[a.kind].label} ${fmtDist(a)}`).join(", ") : "rest"}`}
            onClick={()=>setSel(on ? null : cell)} onMouseEnter={()=>cell.v && setSel(cell)}
            style={{ width:cs, height:cs, padding:0, borderRadius:3, background:heat(cell.v, cell.kind), cursor:"pointer", border:on?"1.5px solid #fff":"1px solid transparent", boxSizing:"border-box" }}/>;
        }))}
      </div>
      <div style={{ marginTop:12, minHeight:20, fontSize:12 }}>
        {sel ? (
          <span style={{ color:TEXT }}>
            <b>{fmtDayW(sel.date)}</b>
            <span style={{ color:MUTED }}> · {sel.acts.length ? sel.acts.map(a => `${KIND[a.kind].icon} ${fmtDist(a)}`).join("  ") + ` · load ${sel.load}` : "Rest day"}</span>
          </span>
        ) : <span style={{ color:MUTED }}>Tap a day for details · darker = lighter load</span>}
      </div>
    </div>
  );
}

// ── Coach tab ─────────────────────────────────────────────────────────────────
const RATING = {
  great:               { label:"Great session", color:GREEN },
  on_target:           { label:"On target", color:BLUE },
  harder_than_ideal:   { label:"Harder than ideal", color:AMBER },
  easier_than_planned: { label:"Easier than planned", color:PURPLE },
  caution:             { label:"Take care", color:RED },
};

function useCoachPlan(acts, settings, long4) {
  return useMemo(() => {
    const runs = acts.filter(a => a.kind === "run");
    const classed = runs.map(a => ({ ...a, _class: classifyRun(a, runs) }));
    return scorePlan(buildPlan(settings.goal, long4), classed);
  }, [acts, settings.goal, long4]);
}

function CoachTab({ acts, settings, d, plan, source, selectedId, setSelectedId, onOpenSettings, onOpenActivity }) {
  const recent = acts.slice(0, 12);
  const a = acts.find(x => x.id === selectedId) || acts[0];
  const [state, setState] = useState({}); // id -> { status, data, error }
  const q = useMemo(() => quickReview(a, acts, plan), [a, acts, plan]);
  const hasAI = typeof source.coachReview === "function";
  const st = state[a.id] || {};

  const load = useCallback(async (refresh = false) => {
    const fit = d.series.find(x => x.date === a.date) || d.cur;
    const context = buildCoachContext(a, acts, settings, fit, plan);
    setState(s => ({ ...s, [a.id]: { ...s[a.id], status:"loading", error:null } }));
    try {
      const data = await source.coachReview(a.id, context, refresh);
      setState(s => ({ ...s, [a.id]: { status:"done", data } }));
    } catch (e) {
      setState(s => ({ ...s, [a.id]: { status:"error", error: source.coachErrorText(e) } }));
    }
  }, [a, acts, settings, plan, d, source]);

  // Review each session the first time it's opened (the server/browser cache makes repeat visits free).
  useEffect(() => { if (hasAI && !state[a.id]) load(false); }, [a.id, hasAI]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = KIND[a.kind];
  const pw = plan?.weeks.find(w => w.key === dateKey(getWeekStart(new Date())));
  const next = nextPlanned(plan, dateKey(new Date()));
  const r = st.data?.review;
  const rating = r && (RATING[r.rating] || RATING.on_target);
  const stat = (l, v) => (
    <div style={{ background:"#111", borderRadius:10, padding:"10px 12px", minWidth:0 }}>
      <p style={{ margin:"0 0 3px", fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</p>
      <p style={{ margin:0, fontSize:16, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{v}</p>
    </div>
  );

  return (<>
    {/* Session picker */}
    <section style={{ marginBottom:14 }}>
      <p style={label}>Sessions</p>
      <div role="listbox" aria-label="Choose a session" style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
        {recent.map(x => {
          const on = x.id === a.id;
          return (
            <button key={x.id} role="option" aria-selected={on} onClick={()=>setSelectedId(x.id)}
              style={{ ...btn, flexShrink:0, textAlign:"left", padding:"8px 12px", background:on?"#fff":CARD2, color:on?"#000":TEXT, border:`1px solid ${on?"#fff":SEP}` }}>
              <span style={{ display:"block", fontSize:11, color:on?"#444":MUTED, fontWeight:500 }}>{fmtDayW(x.date)}</span>
              <span style={{ fontSize:13 }}>{KIND[x.kind].icon} {fmtDist(x)}</span>
            </button>
          );
        })}
      </div>
    </section>

    {/* Session summary */}
    <section style={{ ...card, marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:12 }}>
        <div style={{ minWidth:0 }}>
          <p style={{ margin:"0 0 2px", fontSize:12, color:MUTED }}>{fmtDayLong(a.date)}{a.time ? ` · ${a.time}` : ""}</p>
          <p style={{ margin:0, fontSize:18, fontWeight:700 }}>{k.icon} {a.name}</p>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:k.color, background:`${k.color}22`, padding:"4px 9px", borderRadius:999, flexShrink:0 }}>{q.label}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(96px, 1fr))", gap:8, marginBottom:12 }}>
        {stat("Distance", fmtDist(a))}
        {stat("Time", fmtDur(a.min))}
        {stat(a.kind === "ride" ? "Speed" : "Pace", fmtSpeed(a) || "–")}
        {stat("Effort", a.re ?? "–")}
        {a.kind === "run" && a.cad ? stat("Cadence", `${Math.round(a.cad*2)}`) : stat("Elevation", `${Math.round(a.elev)} m`)}
      </div>
      <p style={{ margin:"0 0 6px", fontSize:13, fontWeight:700 }}>Quick read: {q.verdict}</p>
      <ul style={{ margin:0, paddingLeft:18, display:"grid", gap:4 }}>
        {q.notes.map((n,i) => <li key={i} style={{ fontSize:13, color:"#e5e5ea", lineHeight:1.45 }}>{n}</li>)}
      </ul>
      <button onClick={()=>onOpenActivity(a)} style={{ ...btn, marginTop:12, fontSize:11, padding:"6px 10px" }}>Full details</button>
    </section>

    {/* AI coach review */}
    {hasAI && (
      <section aria-live="polite" style={{ ...card, marginBottom:14, borderColor: rating ? `${rating.color}55` : SEP, background:"linear-gradient(160deg,#1d1d22,#141418)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:10 }}>
          <p style={{ ...label, margin:0 }}>🧑‍🏫 Coach review</p>
          {st.status !== "loading" && (st.status === "done" || st.status === "error") && (
            <button onClick={()=>load(true)} style={{ ...btn, padding:"5px 10px", fontSize:11 }}>↻ {st.status === "error" ? "Try again" : "New review"}</button>
          )}
        </div>
        {st.status === "loading" || !st.status ? (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
            <span aria-hidden="true" style={{ width:18, height:18, border:`2px solid ${CARD2}`, borderTopColor:ORANGE, borderRadius:"50%", animation:REDUCE_MOTION ? "none" : "spin 1s linear infinite", display:"inline-block" }}/>
            <span style={{ fontSize:13, color:MUTED }}>Your coach is reviewing this session…</span>
          </div>
        ) : st.status === "error" ? (
          <p style={{ margin:0, fontSize:13, color:"#e5e5ea", lineHeight:1.5 }}>{st.error}</p>
        ) : r && (<>
          <span style={{ display:"inline-block", fontSize:11, fontWeight:700, color:rating.color, background:`${rating.color}22`, padding:"3px 9px", borderRadius:999, marginBottom:8 }}>{rating.label}</span>
          <p style={{ margin:"0 0 8px", fontSize:18, fontWeight:700, lineHeight:1.3, textWrap:"balance" }}>{r.headline}</p>
          <p style={{ margin:"0 0 14px", fontSize:14, color:"#e5e5ea", lineHeight:1.55 }}>{r.summary}</p>
          {r.went_well.length > 0 && (<>
            <p style={{ margin:"0 0 6px", fontSize:12, fontWeight:700, color:GREEN }}>What went well</p>
            <ul style={{ margin:"0 0 12px", paddingLeft:18, display:"grid", gap:4 }}>{r.went_well.map((x,i) => <li key={i} style={{ fontSize:13, lineHeight:1.45 }}>{x}</li>)}</ul>
          </>)}
          {r.watch_outs.length > 0 && (<>
            <p style={{ margin:"0 0 6px", fontSize:12, fontWeight:700, color:AMBER }}>Watch out for</p>
            <ul style={{ margin:"0 0 12px", paddingLeft:18, display:"grid", gap:4 }}>{r.watch_outs.map((x,i) => <li key={i} style={{ fontSize:13, lineHeight:1.45 }}>{x}</li>)}</ul>
          </>)}
          <div style={{ background:"#0f1a2b", border:`1px solid ${BLUE}44`, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
            <p style={{ margin:"0 0 4px", fontSize:11, color:BLUE, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Next session · {r.next_session.when}</p>
            <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:700 }}>{r.next_session.session}</p>
            <p style={{ margin:0, fontSize:12, color:MUTED, lineHeight:1.45 }}>{r.next_session.why}</p>
          </div>
          <p style={{ margin:"0 0 8px", fontSize:13, lineHeight:1.5 }}><b>This week:</b> {r.week_focus}</p>
          <p style={{ margin:0, fontSize:10, color:MUTED }}>AI coach (Claude){st.data.createdAt ? ` · ${relTime(st.data.createdAt)}` : ""}. A guide, not medical advice.</p>
        </>)}
      </section>
    )}

    {/* Plan */}
    {!plan ? (
      <section style={{ ...card, marginBottom:14, display:"flex", gap:12, alignItems:"center" }}>
        <span style={{ fontSize:26 }}>🗓️</span>
        <p style={{ margin:0, fontSize:13, color:"#e5e5ea", flex:1, lineHeight:1.45 }}>Set an upcoming goal race to get a week-by-week plan your coach can check sessions against.</p>
        <button onClick={onOpenSettings} style={{ ...btn, background:ORANGE }}>Set goal</button>
      </section>
    ) : (<>
      {pw && (
        <section style={{ ...card, marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8, marginBottom:10 }}>
            <p style={{ ...label, margin:0 }}>This week · {pw.phase}</p>
            <span style={{ fontSize:12, color:MUTED }}>{pw.weeksOut === 0 ? "Race week" : `${pw.weeksOut} week${pw.weeksOut>1?"s":""} to race`}</span>
          </div>
          <div style={{ display:"grid", gap:10 }}>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}><span>Running</span><span><b>{pw.doneKm}</b> / {pw.targetKm} km</span></div>
              <Bar100 pct={pw.doneKm / pw.targetKm} color={BLUE}/>
            </div>
            <p style={{ margin:0, fontSize:13 }}>{pw.qualityDone ? "✅" : "⬜️"} Quality: {pw.quality}</p>
            <p style={{ margin:0, fontSize:13 }}>{pw.longDone ? "✅" : "⬜️"} Long run: {pw.longKm} km{pw.doneLong ? <span style={{ color:MUTED }}> (longest so far {pw.doneLong} km)</span> : null}</p>
            {pw.note && <p style={{ margin:0, fontSize:12, color:MUTED }}>{pw.note}</p>}
          </div>
        </section>
      )}
      <section style={{ ...card, marginBottom:14, padding:"16px 0 8px" }}>
        <p style={{ ...label, padding:"0 18px" }}>Plan to {settings.goal.name}</p>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:520 }}>
            <thead><tr style={{ color:MUTED, textAlign:"left" }}>
              {["Week of","Phase","Quality session","Long run","Target","Done"].map(h => <th key={h} style={{ padding:"6px 10px", fontWeight:600, borderBottom:`1px solid ${SEP}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {plan.weeks.map(w => {
                const current = w === pw, past = w.end <= startOfDay();
                return (
                  <tr key={w.key} style={{ background: current ? "#1a2540" : "transparent" }}>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>{fmtDay(w.key)}</td>
                    <td style={{ padding:"8px 10px", color:MUTED }}>{w.phase}</td>
                    <td style={{ padding:"8px 10px" }}>{(past || current) && w.weeksOut ? (w.qualityDone ? "✅ " : past ? "✖️ " : "") : ""}{w.quality}</td>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>{(past || current) && w.weeksOut ? (w.longDone ? "✅ " : past ? "✖️ " : "") : ""}{w.weeksOut ? `${w.longKm} km` : "Race"}</td>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap", color:MUTED }}>{w.targetKm} km</td>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{past || current ? `${w.doneKm} km` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {next && <p style={{ margin:"10px 18px 0", fontSize:12, color:MUTED }}>Coming up: {next.text}.</p>}
      </section>
    </>)}
  </>);
}

function EmptyState({ syncing, error, onSync }) {
  return (
    <div style={{ background:BG, minHeight:"100vh", color:TEXT, fontFamily:"-apple-system, system-ui, sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", boxSizing:"border-box" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ ...card, maxWidth:420, width:"100%", textAlign:"center", padding:"28px 22px" }}>
        <h1 style={{ margin:"0 0 6px", fontSize:22, fontWeight:800 }}>Training</h1>
        {syncing ? (<>
          <div aria-hidden="true" style={{ width:34, height:34, margin:"18px auto", border:`3px solid ${CARD2}`, borderTopColor:ORANGE, borderRadius:"50%", animation:REDUCE_MOTION ? "none" : "spin 1s linear infinite" }}/>
          <p style={{ margin:0, color:MUTED, fontSize:14 }}>Loading your Strava activities…</p>
        </>) : error ? (<>
          <p style={{ margin:"14px 0 18px", color:"#e5e5ea", fontSize:14, lineHeight:1.5 }}>{error.text}</p>
          {error.action && <a href={error.action.href} style={{ ...btn, display:"inline-block", background:ORANGE, padding:"12px 20px", fontSize:14, textDecoration:"none", marginRight:8 }}>{error.action.label}</a>}
          {error.retry && <button onClick={onSync} style={{ ...btn, padding:"12px 20px", fontSize:14 }}>Try again</button>}
        </>) : (<>
          <p style={{ margin:"14px 0 18px", color:MUTED, fontSize:14, lineHeight:1.5 }}>Your runs, rides and swims from Strava will appear here.</p>
          <button onClick={onSync} style={{ ...btn, background:ORANGE, padding:"12px 20px", fontSize:14 }}>Load from Strava</button>
        </>)}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Dashboard({ source }) {
  const cached = useMemo(() => { const c = localGet(CACHE_KEY); return Array.isArray(c?.acts) ? c : null; }, []);
  const [acts, setActs]         = useState(cached?.acts || []);
  const [athlete, setAthlete]   = useState(cached?.athlete || "");
  const [lastSync, setLastSync] = useState(cached?.ts || null);
  const [syncing, setSyncing]   = useState(false);
  const [syncError, setSyncError] = useState(null); // { text, retry }
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [tab, setTab]           = useState(() => { try { return localStorage.getItem("dash_tab") || "Overview"; } catch { return "Overview"; } });
  const [metric, setMetric]     = useState("Distance");
  const [period, setPeriod]     = useState("Weekly");
  const [hidden, setHidden]     = useState({});
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState("all");
  const [showCount, setShowCount] = useState(6);
  const [detail, setDetail]     = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coachId, setCoachId]   = useState(null);
  const [, setTick]             = useState(0);
  const actsRef = useRef(acts);
  actsRef.current = acts;
  const storeRef = useRef(null);
  const athleteRef = useRef(athlete);
  athleteRef.current = athlete;

  const sync = useCallback(async (full = false) => {
    setSyncing(true); setSyncError(null);
    try {
      // Incremental: only ask for activities since 2 days before the newest one we already have (catches edits).
      const newest = actsRef.current[0]?.date;
      const rangeStart = !full && newest ? `${dateKey(addDays(parseLocal(newest), -2))}T00:00:00` : null;
      const fresh = await source.fetchActivities(rangeStart, full);
      const name = athleteRef.current ? null : await source.fetchAthlete();
      const merged = mergeActs(actsRef.current, fresh);
      const ts = Date.now();
      const who = name || athleteRef.current;
      actsRef.current = merged;
      setActs(merged); setLastSync(ts); if (who) setAthlete(who);
      localSet(CACHE_KEY, { acts: merged, athlete: who, ts });
    } catch (e) {
      setSyncError(source.errorText(e));
    } finally { setSyncing(false); }
  }, [source]);

  useEffect(() => {
    (async () => {
      const store = await source.settingsStore();
      storeRef.current = store;
      const s = await store.load();
      const base = store.defaults || DEFAULT_SETTINGS;
      setSettings(s ? { ...base, ...s } : base);
      setSettingsReady(true);
    })();
    if (!lastSync || Date.now() - lastSync > CACHE_TTL) sync(false);
    const id = setInterval(() => setTick(t => t+1), 60000); // keep "updated Xm ago" fresh
    return () => clearInterval(id);
  }, [sync]);

  useEffect(() => { try { localStorage.setItem("dash_tab", tab); } catch {} }, [tab]);

  const saveSettings = async s => {
    setSettings(s); setSettingsError(null);
    try { await storeRef.current?.save(s); }
    catch { setSettingsError("Settings were saved in this browser only. Your account storage didn't accept them."); }
  };

  const d = useMemo(() => computeDashboard(acts, settings), [acts, settings]);
  const plan = useCoachPlan(acts, settings, d.long4);

  // All hooks run above this line on every render.
  if (!acts.length) return (
    <EmptyState syncing={syncing} error={syncError} onSync={() => sync(true)}/>
  );

  const g = settings.goal;

  // Chart data
  const buckets = period === "Monthly" ? d.months : d.weeks;
  const M = { Distance:{ unit:"km", f:s=>s.km, dp:1 }, Time:{ unit:"h", f:s=>s.min/60, dp:1 }, Elevation:{ unit:"m", f:s=>s.elev, dp:0 }, Load:{ unit:"", f:s=>s.load, dp:0 } }[metric];
  const shown = d.kinds.filter(k => !hidden[k]);
  const chartData = buckets.map(b => ({ key:b.key, label:b.label, ...Object.fromEntries(d.kinds.map(k => [k, +M.f(b.sums[k]).toFixed(M.dp)])) }));
  const selBucket = buckets.find(b => b.key === selected);

  const now = new Date();
  const monLabel = now.toLocaleDateString("en-AU",{month:"short"});
  const prevLabel = new Date(now.getFullYear(), now.getMonth()-1, 1).toLocaleDateString("en-AU",{month:"short"});
  const monDiff = r1(d.monKm - d.prevKm);
  const wk = d.thisWeek.sums;
  const weekPct = wk.run.km / d.weeklyTarget;
  const daysLeftInWeek = 7 - ((now.getDay()+6)%7) - 1;
  const remaining = Math.max(0, d.weeklyTarget - wk.run.km);
  const listActs = acts.filter(a => filter === "all" || a.kind === filter);
  const goalUpcoming = d.goalDays != null && d.goalDays >= 0;
  const targetMin = g ? parseTargetTime(g.target) : null;

  return (
    <div style={{ background:BG, minHeight:"100vh", fontFamily:"-apple-system, system-ui, sans-serif", color:TEXT, paddingBottom:48 }}>
      <style>{`
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${BLUE}; outline-offset: 2px; }
        @keyframes spin { to { transform: rotate(360deg) } }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        {/* Header */}
        <header style={{ padding:"22px 16px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
            <div style={{ minWidth:0 }}>
              <h1 style={{ margin:0, fontSize:24, fontWeight:800, letterSpacing:"-0.02em" }}>Training</h1>
              <p style={{ margin:"3px 0 0", fontSize:12, color:MUTED }}>{athlete ? `${athlete} · ` : ""}{d.total} activities</p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>sync(false)} disabled={syncing} aria-label="Sync with Strava"
                style={{ ...btn, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:1, padding:"6px 10px", opacity:syncing?0.7:1 }}>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ display:"inline-block", animation:syncing && !REDUCE_MOTION ? "spin 1s linear infinite" : "none" }}>↻</span>
                  {syncing ? "Syncing…" : "Sync"}
                </span>
                <span style={{ fontSize:9, color:MUTED, fontWeight:500 }}>{relTime(lastSync)}</span>
              </button>
              <button onClick={()=>setSettingsOpen(true)} aria-label="Settings" style={{ ...btn, fontSize:16, padding:"8px 10px" }}>⚙︎</button>
            </div>
          </div>
          <nav role="tablist" aria-label="Sections" style={{ display:"flex", gap:4, marginTop:16, borderBottom:`1px solid ${SEP}` }}>
            {["Overview","Coach","Fitness","Running"].map(t => (
              <button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)}
                style={{ background:"none", border:"none", cursor:"pointer", padding:"10px 12px", fontSize:13, fontWeight:600, color:tab===t?TEXT:MUTED, borderBottom:tab===t?`2px solid ${ORANGE}`:"2px solid transparent", fontFamily:"inherit" }}>{t}</button>
            ))}
          </nav>
        </header>

        <main style={{ padding:"18px 16px 0" }}>
          {syncError && (
            <div role="alert" style={{ ...card, borderColor:`${RED}55`, background:"#2a1416", display:"flex", alignItems:"center", gap:10, marginBottom:16, padding:"12px 14px", flexWrap:"wrap" }}>
              <span style={{ fontSize:13, flex:"1 1 220px", lineHeight:1.45 }}>{syncError.text} Showing data from {relTime(lastSync)}.</span>
              {syncError.action && <a href={syncError.action.href} style={{ ...btn, background:ORANGE, textDecoration:"none" }}>{syncError.action.label}</a>}
              {syncError.retry && <button onClick={()=>sync(false)} style={{ ...btn, background:RED, color:"#000" }}>Try again</button>}
            </div>
          )}
          {settingsError && (
            <div role="status" style={{ ...card, borderColor:`${AMBER}55`, marginBottom:16, padding:"12px 14px", fontSize:13 }}>{settingsError}</div>
          )}

          {tab === "Overview" && (<>
            {/* Goal race */}
            <section style={{ ...card, marginBottom:14, background:"linear-gradient(135deg,#1f1a2e,#141420)", borderColor:"#2e2a45" }}>
              {!settingsReady ? (
                <p style={{ margin:0, fontSize:13, color:MUTED }}>Loading your goal…</p>
              ) : !g ? (
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <span style={{ fontSize:30 }}>🎯</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:15, fontWeight:700 }}>Pick a goal race</p>
                    <p style={{ margin:"3px 0 0", fontSize:12, color:MUTED }}>Add a race to get a countdown, training phase and long-run readiness.</p>
                  </div>
                  <button onClick={()=>setSettingsOpen(true)} style={{ ...btn, background:ORANGE, flexShrink:0 }}>Set goal</button>
                </div>
              ) : goalUpcoming ? (<>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ ...label, margin:"0 0 4px" }}>Goal race</p>
                    <p style={{ margin:0, fontSize:17, fontWeight:700 }}>{g.name}</p>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:MUTED }}>{fmtDayLong(g.date)}{targetMin ? ` · target ${fmtClock(targetMin)} (${fmtPace(targetMin/g.km)} /km)` : ""}</p>
                  </div>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <p style={{ margin:0, fontSize:30, fontWeight:800, color:ORANGE, lineHeight:1 }}>{d.goalDays === 0 ? "🏁" : d.goalDays}</p>
                    <p style={{ margin:"3px 0 0", fontSize:10, color:MUTED, letterSpacing:"0.08em" }}>{d.goalDays === 0 ? "RACE DAY" : d.goalDays === 1 ? "DAY TO GO" : "DAYS TO GO"}</p>
                  </div>
                </div>
                <div style={{ display:"grid", gap:10 }}>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                      <span style={{ color:MUTED }}>Longest run (last 4 wks)</span><span><b>{r1(d.long4)}</b> / {d.peakLong} km peak</span>
                    </div>
                    <Bar100 pct={d.long4/d.peakLong} color={PURPLE}/>
                  </div>
                  <p style={{ margin:0, fontSize:12, color:MUTED }}>
                    Phase: <b style={{ color:TEXT }}>{d.goalDays <= 14 ? "Taper" : d.goalDays <= 35 ? "Peak" : d.goalDays <= 84 ? "Build" : "Base"}</b> · avg {r1(d.avg4Run)} km/week running
                  </p>
                </div>
              </>) : (
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <span style={{ fontSize:30 }}>🏅</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:15, fontWeight:700 }}>{g.name} · {fmtDay(g.date)}</p>
                    <p style={{ margin:"3px 0 0", fontSize:12, color:MUTED }}>
                      {d.raceResult ? `Finished in ${fmtClock(d.raceResult.min)} (${fmtPace(d.raceResult.min/d.raceResult.km)} /km). ` : `${-d.goalDays} days ago. `}
                      Set your next goal for a countdown and readiness tracking.
                    </p>
                  </div>
                  <button onClick={()=>setSettingsOpen(true)} style={{ ...btn, background:ORANGE, flexShrink:0 }}>Set goal</button>
                </div>
              )}
            </section>

            {/* Latest session → coach */}
            {acts[0] && (() => {
              const last = acts[0], lq = quickReview(last, acts, plan);
              return (
                <button onClick={()=>{ setCoachId(last.id); setTab("Coach"); }}
                  style={{ ...card, width:"100%", textAlign:"left", cursor:"pointer", color:TEXT, fontFamily:"inherit", marginBottom:14, display:"flex", alignItems:"center", gap:14 }}>
                  <span style={{ fontSize:26 }}>🧑‍🏫</span>
                  <span style={{ flex:1, minWidth:0 }}>
                    <span style={{ display:"block", fontSize:11, color:MUTED, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600, marginBottom:3 }}>Latest session · {fmtDayW(last.date)}</span>
                    <span style={{ display:"block", fontSize:15, fontWeight:700 }}>{KIND[last.kind].icon} {lq.label} · {fmtDist(last)} · {lq.verdict}</span>
                    <span style={{ display:"block", fontSize:12, color:MUTED, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{lq.notes[0]}</span>
                  </span>
                  <span style={{ fontSize:12, color:ORANGE, fontWeight:700, flexShrink:0 }}>Coach review →</span>
                </button>
              );
            })()}

            {/* This week */}
            <section style={{ ...card, marginBottom:14, display:"flex", gap:18, alignItems:"center" }}>
              <Ring pct={weekPct}>
                <span style={{ fontSize:22, fontWeight:800, lineHeight:1 }}>{r1(wk.run.km)}</span>
                <span style={{ fontSize:10, color:MUTED, marginTop:2 }}>of {d.weeklyTarget} km</span>
              </Ring>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ ...label, margin:"0 0 8px" }}>This week</p>
                {d.kinds.filter(k => wk[k].n).map(k => (
                  <p key={k} style={{ margin:"0 0 4px", fontSize:13 }}>
                    <span style={{ color:KIND[k].color }}>{KIND[k].icon} {KIND[k].label}</span>{" "}
                    <b>{k === "swim" ? `${Math.round(wk[k].km*1000).toLocaleString()} m` : `${r1(wk[k].km)} km`}</b>
                    <span style={{ color:MUTED }}> · {wk[k].n}×</span>
                  </p>
                ))}
                {!d.thisWeek.items.length && <p style={{ margin:"0 0 4px", fontSize:13, color:MUTED }}>No activities yet this week.</p>}
                <p style={{ margin:"6px 0 0", fontSize:12, color: weekPct >= 1 ? GREEN : MUTED }}>
                  {weekPct >= 1 ? "🎯 Weekly running target hit!" : `${r1(remaining)} km to go${daysLeftInWeek ? ` · ${daysLeftInWeek} day${daysLeftInWeek>1?"s":""} left` : " today"}`}
                  {" · "}{fmtDur(sumBy(KINDS, k=>wk[k].min))} total
                </p>
              </div>
            </section>

            {/* KPIs */}
            <section style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:14 }}>
              <Stat label="Streak" value={`${d.streak} day${d.streak===1?"":"s"}`} color={ORANGE} sub="consecutive active days"/>
              <Stat label={`${monLabel} to date`} value={`${d.monKm} km`} color={BLUE}
                sub={`${monDiff>=0?"↑":"↓"} ${Math.abs(monDiff)} km vs ${prevLabel} 1–${now.getDate()}`} subColor={monDiff>=0?GREEN:RED}/>
              <Stat label="Form" value={d.form.label} color={d.form.color} sub={`TSB ${d.cur.tsb > 0 ? "+" : ""}${d.cur.tsb}`}/>
              <Stat label="Fitness" value={Math.round(d.cur.ctl)} color={PURPLE}
                sub={`${d.cur.ctl - d.ctl28 >= 0 ? "↑" : "↓"} ${Math.abs(r1(d.cur.ctl - d.ctl28))} in 4 weeks`} subColor={d.cur.ctl >= d.ctl28 ? GREEN : RED}/>
            </section>

            {/* Coach notes */}
            {d.insights.length > 0 && (
              <section style={{ ...card, marginBottom:14 }}>
                <p style={label}>Coach notes</p>
                <div style={{ display:"grid", gap:10 }}>
                  {d.insights.map((x,i) => (
                    <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontSize:15, lineHeight:"20px" }}>{x.icon}</span>
                      <p style={{ margin:0, fontSize:13, lineHeight:1.5, color:"#e5e5ea" }}>{x.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <CalendarHeatmap days={d.calDays} kinds={d.kinds}/>

            {/* Volume chart */}
            <section style={{ marginBottom:20 }}>
              <p style={label}>Volume</p>
              <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                <Segmented ariaLabel="Metric" options={["Distance","Time","Elevation","Load"]} active={metric} onSelect={m=>setMetric(m)} style={{ flex:"1 1 260px" }}/>
                <Segmented ariaLabel="Period" options={["Weekly","Monthly"]} active={period} onSelect={p=>{ setPeriod(p); setSelected(null); }} style={{ flex:"0 1 160px" }}/>
              </div>
              <div style={{ display:"flex", gap:14, marginBottom:10 }}>
                {d.kinds.map(k => (
                  <button key={k} aria-pressed={!hidden[k]} onClick={()=>setHidden(h => ({ ...h, [k]:!h[k] }))}
                    style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:"2px 0", fontFamily:"inherit" }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:hidden[k]?"#444":KIND[k].color }}/>
                    <span style={{ fontSize:12, color:hidden[k]?MUTED:TEXT }}>{KIND[k].label}</span>
                  </button>
                ))}
              </div>
              <div style={{ ...card, padding:"14px 6px 8px" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top:12, right:8, left:0, bottom:0 }}
                    onClick={e => {
                      // activePayload exists in Recharts 2; activeIndex/activeLabel are the fallback for Recharts 3
                      const row = e?.activePayload?.[0]?.payload ?? chartData[Number(e?.activeIndex)] ?? chartData.find(r => r.label === e?.activeLabel);
                      if (row) setSelected(s => s===row.key ? null : row.key);
                    }} style={{ cursor:"pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8}/>
                    <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} width={44} tickFormatter={v => `${v}${M.unit ? ` ${M.unit}` : ""}`}/>
                    <Tooltip {...tooltipStyle} formatter={(v,n) => [`${v}${M.unit ? ` ${M.unit}` : ""}`, n]}/>
                    {shown.map((k, i) => (
                      <Bar key={k} dataKey={k} name={KIND[k].label} stackId="v" fill={KIND[k].color} maxBarSize={30}
                        radius={i === shown.length-1 ? [4,4,0,0] : [0,0,0,0]} isAnimationActive={!REDUCE_MOTION} animationDuration={500}>
                        {chartData.map(row => <Cell key={row.key} fillOpacity={selected && selected !== row.key ? 0.35 : 1}/>)}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <p style={{ margin:"4px 0 0", textAlign:"center", fontSize:10, color:MUTED }}>Tap a bar to see its activities</p>
              </div>
              {selBucket && (
                <div style={{ ...card, marginTop:10, borderColor:`${BLUE}55` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:700 }}>{selBucket.title}</p>
                    <button aria-label="Close period details" onClick={()=>setSelected(null)} style={{ ...btn, padding:"4px 9px" }}>✕</button>
                  </div>
                  <p style={{ margin:"0 0 10px", fontSize:12, color:MUTED }}>
                    {selBucket.items.length} activities · {r1(sumBy(KINDS, k=>selBucket.sums[k].km))} km · {fmtDur(sumBy(KINDS, k=>selBucket.sums[k].min))} · load {sumBy(KINDS, k=>selBucket.sums[k].load)}
                  </p>
                  <div style={{ display:"grid", gap:8 }}>
                    {selBucket.items.map(a => <ActivityRow key={a.id} a={a} onOpen={setDetail}/>)}
                    {!selBucket.items.length && <p style={{ margin:0, fontSize:13, color:MUTED }}>No activities in this period.</p>}
                  </div>
                </div>
              )}
            </section>

            {/* Activities */}
            <section>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8, flexWrap:"wrap" }}>
                <p style={{ ...label, margin:0 }}>Activities</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["all", ...d.kinds].map(k => (
                    <button key={k} aria-pressed={filter===k} onClick={()=>{ setFilter(k); setShowCount(6); }}
                      style={{ ...btn, padding:"5px 10px", fontSize:11, background:filter===k?"#fff":CARD2, color:filter===k?"#000":MUTED }}>
                      {k === "all" ? "All" : `${KIND[k].icon} ${KIND[k].label}`}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gap:8 }}>
                {listActs.slice(0, showCount).map(a => <ActivityRow key={a.id} a={a} onOpen={setDetail}/>)}
              </div>
              {listActs.length > showCount && (
                <button onClick={()=>setShowCount(c => c+10)} style={{ ...btn, width:"100%", marginTop:10, padding:12 }}>Show more ({listActs.length - showCount} left)</button>
              )}
            </section>
          </>)}

          {tab === "Fitness" && (<>
            <section style={{ ...card, marginBottom:14 }}>
              <p style={label}>Today</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                {[["Fitness", Math.round(d.cur.ctl), PURPLE, "42-day load"], ["Fatigue", Math.round(d.cur.atl), "#f472b6", "7-day load"], ["Form", `${d.cur.tsb>0?"+":""}${Math.round(d.cur.tsb)}`, d.form.color, d.form.label]].map(([l,v,c,s]) => (
                  <div key={l} style={{ background:"#111", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                    <p style={{ margin:"0 0 4px", fontSize:11, color:MUTED }}>{l}</p>
                    <p style={{ margin:0, fontSize:24, fontWeight:800, color:c }}>{v}</p>
                    <p style={{ margin:"2px 0 0", fontSize:10, color:MUTED }}>{s}</p>
                  </div>
                ))}
              </div>
              <p style={{ margin:0, fontSize:13, color:"#e5e5ea", lineHeight:1.5 }}>{d.form.text}</p>
            </section>

            <section style={{ ...card, marginBottom:14, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Fitness &amp; fatigue · 90 days</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={d.series.slice(-90)} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={30}/>
                  <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <Tooltip {...tooltipStyle}/>
                  <Line type="monotone" dataKey="ctl" name="Fitness" stroke={PURPLE} strokeWidth={2.5} dot={false} isAnimationActive={!REDUCE_MOTION}/>
                  <Line type="monotone" dataKey="atl" name="Fatigue" stroke="#f472b6" strokeWidth={1.5} dot={false} strokeOpacity={0.8} isAnimationActive={!REDUCE_MOTION}/>
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section style={{ ...card, marginBottom:14, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Form · 90 days</p>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={d.series.slice(-90)} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="formFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.35}/><stop offset="50%" stopColor={GREEN} stopOpacity={0.05}/>
                      <stop offset="50%" stopColor={BLUE} stopOpacity={0.05}/><stop offset="100%" stopColor={BLUE} stopOpacity={0.35}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={30}/>
                  <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <ReferenceLine y={0} stroke="#555"/>
                  <ReferenceLine y={-30} stroke={RED} strokeDasharray="3 3" strokeOpacity={0.5}/>
                  <Tooltip {...tooltipStyle}/>
                  <Area type="monotone" dataKey="tsb" name="Form" stroke="#d4d4d8" strokeWidth={1.5} fill="url(#formFill)" isAnimationActive={!REDUCE_MOTION}/>
                </AreaChart>
              </ResponsiveContainer>
              <p style={{ margin:"4px 12px 0", fontSize:11, color:MUTED, lineHeight:1.5 }}>
                Above 0 = fresh, −10 to −30 = productive training, below −30 (red line) = overreaching risk. Built from Strava Relative Effort.
              </p>
            </section>

            <section style={{ ...card, marginBottom:14, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Weekly load by sport</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.weeks.map(w => ({ label:w.label, ...Object.fromEntries(d.kinds.map(k => [k, w.sums[k].load])) }))} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={8}/>
                  <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                  <Tooltip {...tooltipStyle}/>
                  {d.kinds.map((k,i) => <Bar key={k} dataKey={k} name={KIND[k].label} stackId="l" fill={KIND[k].color} maxBarSize={28} radius={i===d.kinds.length-1?[4,4,0,0]:[0,0,0,0]} isAnimationActive={!REDUCE_MOTION}/>)}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={{ ...card, padding:"16px 6px 8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 12px", marginBottom:8 }}>
                <p style={{ ...label, margin:0 }}>VO₂ max</p>
                <button onClick={()=>setSettingsOpen(true)} style={{ ...btn, padding:"4px 10px", fontSize:11 }}>+ Add reading</button>
              </div>
              {settings.vo2.length ? (() => {
                const v = settings.vo2, last = v[v.length-1], peak = Math.max(...v.map(x=>x.v));
                return (<>
                  <p style={{ margin:"0 12px 8px", fontSize:13 }}>
                    <b style={{ fontSize:22, color:AMBER }}>{last.v}</b> <span style={{ color:MUTED }}>ml/kg/min · {fmtDay(last.date)}{last.v < peak ? ` · peak ${peak}` : " · all-time high 🎉"}</span>
                  </p>
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={v.map(x => ({ label:fmtDay(x.date), v:x.v }))} margin={{ top:8, right:22, left:-20, bottom:0 }}>
                      <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={AMBER} stopOpacity={0.3}/><stop offset="95%" stopColor={AMBER} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fontSize:9, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={12}/>
                      <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize:9, fill:MUTED }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <ReferenceLine y={peak} stroke={AMBER} strokeDasharray="3 3" strokeOpacity={0.5}/>
                      <Tooltip {...tooltipStyle} formatter={x => [`${x} ml/kg/min`, "VO₂ max"]}/>
                      <Area type="monotone" dataKey="v" stroke={AMBER} strokeWidth={2.5} fill="url(#vg)" dot={{ fill:AMBER, r:3 }} isAnimationActive={!REDUCE_MOTION}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  {daysBetween(parseLocal(last.date), now) > 30 && <p style={{ margin:"6px 12px 0", fontSize:11, color:MUTED }}>Last reading was {daysBetween(parseLocal(last.date), now)} days ago — add your latest from your watch.</p>}
                </>);
              })() : <p style={{ margin:"0 12px 8px", fontSize:13, color:MUTED }}>Add readings from your watch to track your trend.</p>}
            </section>
          </>)}

          {tab === "Running" && (<>
            <section style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:14 }}>
              <Stat label="Longest run" value={d.longest ? `${r1(d.longest.km)} km` : "–"} color={PURPLE} sub={d.longest && `${fmtDay(d.longest.date)} · ${fmtDur(d.longest.min)}`}/>
              <Stat label="Fastest run (5 km+)" value={d.fastest ? `${fmtPace(d.fastest.min/d.fastest.km)} /km` : "–"} color={GREEN} sub={d.fastest && `${r1(d.fastest.km)} km · ${fmtDay(d.fastest.date)}`}/>
              <Stat label="Biggest week (12 wks)" value={d.bigWeek ? `${r1(d.bigWeek.sums.run.km)} km` : "–"} color={BLUE} sub={d.bigWeek && d.bigWeek.title}/>
              <Stat label="Cadence (last 10)" value={d.cadence ? `${d.cadence} spm` : "–"} color={AMBER} sub={d.cadence ? (d.cadence < 165 ? "Try a few more, shorter steps" : "Nice and quick") : null}/>
            </section>

            <section style={{ ...card, marginBottom:14, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Pace trend · 16 weeks</p>
              {d.pace.length ? (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={d.pace} margin={{ top:4, right:10, left:-6, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={24}/>
                    <YAxis reversed domain={[d.paceTicks[0], d.paceTicks[d.paceTicks.length-1]]} ticks={d.paceTicks} tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} tickFormatter={fmtPace} width={44}/>
                    <Tooltip {...tooltipStyle} formatter={(v, n) => [`${fmtPace(v)} /km`, n]}/>
                    <Line dataKey="pace" name="Run pace" stroke={BLUE} strokeOpacity={0} dot={{ r:3, fill:BLUE, fillOpacity:0.6, strokeWidth:0 }} activeDot={{ r:5 }} isAnimationActive={false}/>
                    <Line type="monotone" dataKey="avg" name="5-run avg" stroke={GREEN} strokeWidth={2.5} dot={false} isAnimationActive={!REDUCE_MOTION}/>
                  </LineChart>
                </ResponsiveContainer>
              ) : <p style={{ margin:"0 12px 12px", color:MUTED, fontSize:13 }}>No runs in the last 16 weeks.</p>}
              <p style={{ margin:"4px 12px 0", fontSize:11, color:MUTED }}>Higher = faster. Dots are individual runs; the line is your rolling average.</p>
            </section>

            <section style={{ ...card, marginBottom:14, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Long run progression</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.weeks.map(w => ({ label:w.label, km:r1(w.longRun) }))} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={8}/>
                  <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} domain={[0, dataMax => Math.ceil(Math.max(dataMax, goalUpcoming ? d.peakLong : 0)/5)*5]} allowDecimals={false}/>
                  <Tooltip {...tooltipStyle} formatter={v => [`${v} km`, "Longest run"]}/>
                  <Bar dataKey="km" fill={PURPLE} radius={[4,4,0,0]} maxBarSize={28} isAnimationActive={!REDUCE_MOTION}/>
                  {goalUpcoming && <ReferenceLine y={d.peakLong} stroke={PURPLE} strokeDasharray="4 4" label={{ value:`Peak ${d.peakLong} km`, fill:PURPLE, fontSize:10, position:"insideTopLeft" }}/>}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section style={{ ...card, padding:"16px 6px 8px" }}>
              <p style={{ ...label, paddingLeft:12 }}>Weekly running distance</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.weeks.map(w => ({ label:w.label, km:r1(w.sums.run.km) }))} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} minTickGap={8}/>
                  <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} domain={[0, dataMax => Math.ceil(Math.max(dataMax, d.weeklyTarget)*1.1/5)*5]} allowDecimals={false}/>
                  <Tooltip {...tooltipStyle} formatter={v => [`${v} km`, "Running"]}/>
                  <Bar dataKey="km" fill={BLUE} radius={[4,4,0,0]} maxBarSize={28} isAnimationActive={!REDUCE_MOTION}/>
                  <ReferenceLine y={d.weeklyTarget} stroke={GREEN} strokeDasharray="4 4" label={{ value:`Target ${d.weeklyTarget} km`, fill:GREEN, fontSize:10, position:"insideTopLeft" }}/>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </>)}
          {tab === "Coach" && (
            <CoachTab acts={acts} settings={settings} d={d} plan={plan} source={source}
              selectedId={coachId} setSelectedId={setCoachId} onOpenSettings={()=>setSettingsOpen(true)} onOpenActivity={setDetail}/>
          )}
        </main>
      </div>

      {detail && <ActivityDetail a={detail} onClose={()=>setDetail(null)}/>}
      {settingsOpen && <SettingsSheet settings={settings} auto={settings.weeklyRunKm ? Math.max(10, Math.ceil(d.avg4Run/5)*5) : d.weeklyTarget}
        onSave={saveSettings} onClose={()=>setSettingsOpen(false)} onResync={()=>sync(true)} syncing={syncing}/>}
    </div>
  );
}
