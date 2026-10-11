import { useState, useEffect } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine, Area, AreaChart } from "recharts";

const BG = "#000", CARD = "#1c1c1e", BLUE = "#4a9eff", ORANGE = "#f4511e", GREEN = "#10b981", TEXT = "#fff", MUTED = "#8e8e93", SEP = "#2c2c2e";
const RACE_DATE = new Date(2026, 7, 30); // 30 Aug 2026, local midnight
const CACHE_KEY = "strava_v3"; // v3 caches raw activities, not computed stats
const CACHE_TTL = 30 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
// Activity dates are "YYYY-MM-DD" local dates. new Date("YYYY-MM-DD") parses as UTC
// and toISOString() returns UTC, both of which shift days in non-UTC timezones.
function parseLocal(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfDay(d = new Date()) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

function getWeekStart(d = new Date()) {
  const r = startOfDay(d);
  const day = r.getDay(); r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function daysToRace() { return Math.round((RACE_DATE - startOfDay()) / 86400000); }
function fmtTime(m) { const h = Math.floor(m/60), mn = Math.round(m%60); return h > 0 ? `${h}h ${mn}m` : `${mn}m`; }
function fmtDate(s) { return parseLocal(s).toLocaleDateString("en-AU",{day:"numeric",month:"short"}); }
const sum = (arr, k) => arr.reduce((s,a)=>s+(a[k]||0),0);

function computeDashboard(activities) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = getWeekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart  = new Date(now.getFullYear(), now.getMonth()-1, 1);
  // Same day-of-month last month (end of that day), clamped so e.g. 31 Mar compares to 28/29 Feb, not 3 Mar.
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevEnd = new Date(now.getFullYear(), now.getMonth()-1, Math.min(now.getDate(), prevMonthDays) + 1);

  const sorted = activities
    .map(a => ({ ...a, _d: parseLocal(a.date) }))
    .sort((a,b) => b._d - a._d);
  const inRange = (from, to) => sorted.filter(a => a._d >= from && a._d < to);

  const thisWeek  = inRange(weekStart, tomorrow);
  const thisMonth = inRange(monthStart, tomorrow);
  const prevMonth = inRange(prevStart, prevEnd);

  const weekRun  = +sum(thisWeek.filter(a=>a.sport_type==="Run"), "distance_km").toFixed(1);
  const weekRide = +sum(thisWeek.filter(a=>a.sport_type==="Ride"), "distance_km").toFixed(1);
  const weekTime = sum(thisWeek, "moving_time_min");
  const weekSessions = thisWeek.length;
  const monKm    = +sum(thisMonth, "distance_km").toFixed(1);
  const prevKm   = +sum(prevMonth, "distance_km").toFixed(1);

  // Streak (today counts if active; otherwise start from yesterday)
  const activeDays = new Set(sorted.map(a=>a.date));
  let streak = 0;
  for (let i=0; i<365; i++) {
    if (activeDays.has(dateKey(addDays(today, -i)))) streak++;
    else if (i>0) break;
  }

  const bucket = (list, lbl) => {
    const run = list.filter(a=>a.sport_type==="Run"), ride = list.filter(a=>a.sport_type==="Ride");
    return {
      Distance:    { label:lbl, run:+sum(run,"distance_km").toFixed(1),     ride:+sum(ride,"distance_km").toFixed(1) },
      Time:        { label:lbl, run:+sum(run,"moving_time_min").toFixed(0), ride:+sum(ride,"moving_time_min").toFixed(0) },
      "Elev Gain": { label:lbl, run:+sum(run,"elevation_m").toFixed(0),     ride:+sum(ride,"elevation_m").toFixed(0) },
    };
  };
  const pushBucket = (chart, b) => Object.keys(chart).forEach(k => chart[k].push(b[k]));

  // Weekly chart (10 weeks, Mon–Sun)
  const wChart = { Distance:[], Time:[], "Elev Gain":[] };
  for (let w=9; w>=0; w--) {
    const ws = addDays(weekStart, -w*7);
    const lbl = ws.toLocaleDateString("en-AU",{day:"numeric",month:"short"});
    pushBucket(wChart, bucket(inRange(ws, addDays(ws, 7)), lbl));
  }

  // Calendar (12 Monday-aligned weeks; week 0 = current week)
  const calDays = [];
  for (let d = addDays(weekStart, -11*7); d <= today; d = addDays(d, 1)) {
    const ds = dateKey(d);
    const da = sorted.filter(a=>a.date===ds);
    const isRun = da.some(a=>a.sport_type==="Run");
    const me = Math.max(0,...da.map(a=>a.relative_effort||0));
    const v = me>100?4:me>70?3:me>30?2:da.length>0?1:0;
    const week = Math.round((weekStart - getWeekStart(d)) / (7*86400000));
    calDays.push({ date:ds, day:d.getDay(), week, label:fmtDate(ds), v, type: isRun?"run":da.length?"ride":null });
  }

  // Monthly chart (6 months)
  const mChart = { Distance:[], Time:[], "Elev Gain":[] };
  for (let m=5; m>=0; m--) {
    const ms = new Date(now.getFullYear(), now.getMonth()-m, 1);
    const me = new Date(now.getFullYear(), now.getMonth()-m+1, 1);
    const lbl = ms.toLocaleDateString("en-AU",{month:"short"});
    pushBucket(mChart, bucket(inRange(ms, me), lbl));
  }

  const recent = sorted.slice(0,5).map(({ _d, ...a }) => a);
  return { recent, total:sorted.length, weekRun, weekRide, weekTime, weekSessions, monKm, prevKm, streak, wChart, mChart, calDays };
}

// ── Storage helpers ───────────────────────────────────────────────────────────
// Raw activities are cached and stats recomputed on load, so "this week"/streak stay correct across days.
async function cacheGet() {
  try {
    const r = await window.storage.get(CACHE_KEY);
    const { data, ts } = JSON.parse(r.value);
    if (!Array.isArray(data?.activities)) return null;
    return { data, stale: Date.now()-ts > CACHE_TTL, ts };
  } catch { return null; }
}
async function cacheSet(data) {
  try { await window.storage.set(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// Pull the JSON object out of the model's reply even if it adds prose or code fences around it.
function extractJson(text) {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON in response");
  return JSON.parse(text.slice(start, end+1));
}

// ── Seed data (baked in — renders instantly, refreshed in background) ────────
const SEED_ACTIVITIES = [
  {id:"1",name:"Morning Run",sport_type:"Run",date:"2026-07-18",distance_km:10.1,moving_time_min:68.4,elevation_m:7,relative_effort:116,calories:1047,pr_count:10},
  {id:"2",name:"Morning Run",sport_type:"Run",date:"2026-07-16",distance_km:10.2,moving_time_min:71.1,elevation_m:8,relative_effort:153,calories:751,pr_count:0},
  {id:"3",name:"Morning Run",sport_type:"Run",date:"2026-07-14",distance_km:10.5,moving_time_min:70.9,elevation_m:72,relative_effort:110,calories:841,pr_count:8},
  {id:"4",name:"Afternoon Run",sport_type:"Run",date:"2026-07-12",distance_km:9.0,moving_time_min:61.8,elevation_m:61,relative_effort:111,calories:657,pr_count:1},
  {id:"5",name:"Morning Run",sport_type:"Run",date:"2026-07-11",distance_km:8.9,moving_time_min:58.7,elevation_m:59,relative_effort:93,calories:651,pr_count:0},
  {id:"6",name:"Morning Ride",sport_type:"Ride",date:"2026-07-11",distance_km:25.6,moving_time_min:62.5,elevation_m:141,relative_effort:78,calories:691,pr_count:89},
  {id:"7",name:"Morning Run",sport_type:"Run",date:"2026-07-10",distance_km:8.7,moving_time_min:62.1,elevation_m:59,relative_effort:110,calories:825,pr_count:0},
  {id:"8",name:"Evening Ride",sport_type:"Ride",date:"2026-07-08",distance_km:21.7,moving_time_min:53.0,elevation_m:123,relative_effort:126,calories:670,pr_count:83},
  {id:"9",name:"Morning Run",sport_type:"Run",date:"2026-07-08",distance_km:6.6,moving_time_min:48.7,elevation_m:50,relative_effort:116,calories:707,pr_count:0},
  {id:"10",name:"Morning Run",sport_type:"Run",date:"2026-07-05",distance_km:8.8,moving_time_min:59.0,elevation_m:59,relative_effort:82,calories:913,pr_count:0},
  {id:"11",name:"Morning Ride",sport_type:"Ride",date:"2026-07-04",distance_km:25.6,moving_time_min:69.0,elevation_m:141,relative_effort:46,calories:751,pr_count:0},
  {id:"12",name:"Morning Run",sport_type:"Run",date:"2026-07-03",distance_km:8.8,moving_time_min:59.8,elevation_m:59,relative_effort:108,calories:912,pr_count:0},
  {id:"13",name:"Evening Ride",sport_type:"Ride",date:"2026-07-02",distance_km:25.4,moving_time_min:66.8,elevation_m:142,relative_effort:41,calories:769,pr_count:5},
  {id:"14",name:"Morning Run",sport_type:"Run",date:"2026-06-28",distance_km:7.0,moving_time_min:47.3,elevation_m:51,relative_effort:109,calories:719,pr_count:0},
  {id:"15",name:"Lunch Ride",sport_type:"Ride",date:"2026-06-27",distance_km:21.8,moving_time_min:56.4,elevation_m:123,relative_effort:35,calories:665,pr_count:9},
  {id:"16",name:"Morning Run",sport_type:"Run",date:"2026-06-26",distance_km:8.0,moving_time_min:55.6,elevation_m:55,relative_effort:137,calories:834,pr_count:0},
  {id:"17",name:"Morning Ride",sport_type:"Ride",date:"2026-06-25",distance_km:18.1,moving_time_min:52.2,elevation_m:105,relative_effort:12,calories:504,pr_count:0},
  {id:"18",name:"Morning Ride",sport_type:"Ride",date:"2026-06-21",distance_km:25.7,moving_time_min:65.1,elevation_m:141,relative_effort:23,calories:585,pr_count:14},
  {id:"19",name:"Morning Run",sport_type:"Run",date:"2026-06-20",distance_km:7.7,moving_time_min:53.2,elevation_m:55,relative_effort:115,calories:791,pr_count:0},
  {id:"20",name:"Morning Ride",sport_type:"Ride",date:"2026-06-19",distance_km:25.7,moving_time_min:67.8,elevation_m:141,relative_effort:26,calories:770,pr_count:16},
  {id:"21",name:"Morning Run",sport_type:"Run",date:"2026-06-17",distance_km:6.5,moving_time_min:46.3,elevation_m:50,relative_effort:85,calories:669,pr_count:0},
  {id:"22",name:"Morning Ride",sport_type:"Ride",date:"2026-06-16",distance_km:25.6,moving_time_min:65.0,elevation_m:141,relative_effort:16,calories:707,pr_count:19},
  {id:"23",name:"Morning Run",sport_type:"Run",date:"2026-06-14",distance_km:6.4,moving_time_min:43.3,elevation_m:50,relative_effort:77,calories:660,pr_count:0},
  {id:"24",name:"Morning Ride",sport_type:"Ride",date:"2026-06-13",distance_km:21.8,moving_time_min:58.7,elevation_m:123,relative_effort:14,calories:630,pr_count:0},
  {id:"25",name:"Morning Run",sport_type:"Run",date:"2026-06-12",distance_km:6.4,moving_time_min:44.4,elevation_m:50,relative_effort:97,calories:666,pr_count:0},
  {id:"26",name:"Morning Ride",sport_type:"Ride",date:"2026-06-11",distance_km:21.8,moving_time_min:58.9,elevation_m:123,relative_effort:16,calories:634,pr_count:0},
  {id:"27",name:"Morning Run",sport_type:"Run",date:"2026-06-10",distance_km:6.4,moving_time_min:44.3,elevation_m:51,relative_effort:87,calories:477,pr_count:0},
  {id:"28",name:"Morning Ride",sport_type:"Ride",date:"2026-06-08",distance_km:18.0,moving_time_min:47.3,elevation_m:105,relative_effort:30,calories:487,pr_count:0},
  {id:"29",name:"Morning Run",sport_type:"Run",date:"2026-06-07",distance_km:6.6,moving_time_min:43.4,elevation_m:50,relative_effort:100,calories:590,pr_count:1},
  {id:"30",name:"Morning Run",sport_type:"Run",date:"2026-06-06",distance_km:6.4,moving_time_min:44.3,elevation_m:50,relative_effort:72,calories:466,pr_count:0},
];
const SEED_TS = new Date("2026-07-18T12:00:00").getTime();

// ── Subcomponents ─────────────────────────────────────────────────────────────
function TabBar({ options, active, onSelect, style={} }) {
  return (
    <div style={{ display:"flex", background:"#2c2c2e", borderRadius:8, padding:2, ...style }}>
      {options.map(o => (
        <button key={o} onClick={()=>onSelect(o)} style={{ flex:1, padding:"6px 0", fontSize:12, fontWeight:600, background:active===o?"#fff":"transparent", color:active===o?"#000":MUTED, border:"none", borderRadius:6, cursor:"pointer", fontFamily:"system-ui" }}>{o}</button>
      ))}
    </div>
  );
}

function KpiCard({ label, value, unit, sub, color, icon, subColor }) {
  return (
    <div style={{ background:CARD, borderRadius:14, padding:"16px 18px", border:`1px solid ${SEP}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
        <p style={{ margin:0, fontSize:11, color:MUTED, fontFamily:"system-ui" }}>{label}</p>
        <span style={{ fontSize:16 }}>{icon}</span>
      </div>
      <p style={{ margin:"0 0 2px", fontSize:26, fontWeight:800, color, letterSpacing:"-0.04em", lineHeight:1 }}>{value}</p>
      {unit && <p style={{ margin:"0 0 6px", fontSize:11, color:MUTED, fontFamily:"system-ui" }}>{unit}</p>}
      <p style={{ margin:0, fontSize:11, color:subColor||"#4ade80", fontFamily:"system-ui" }}>{sub}</p>
    </div>
  );
}

function heatColor(v, type) {
  if (!v) return "#1c1c1e";
  return type==="run" ? ["","#1a3a5c","#1e6ba8","#2196f3","#4a9eff"][v] : ["","#3d1f0a","#8b3a0f","#c94b1a","#f4511e"][v];
}

function CalendarHeatmap({ days }) {
  const [hov, setHov] = useState(null);
  const WEEKS = 12, cs = 13, gap = 3;
  return (
    <div style={{ background:CARD, borderRadius:14, padding:"20px 18px", border:`1px solid ${SEP}`, marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase" }}>Activity Calendar</p>
        <div style={{ display:"flex", gap:12 }}>
          {[["#2196f3","Run"],[ORANGE,"Ride"]].map(([c,l])=>(
            <span key={l} style={{ fontSize:10, color:MUTED, display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:c, display:"inline-block" }}/>{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:2 }}>
        <div style={{ display:"flex", flexDirection:"column", gap, marginRight:4 }}>
          {["M","T","W","T","F","S","S"].map((d,i)=>(
            <div key={i} style={{ height:cs, fontSize:8, color:MUTED, display:"flex", alignItems:"center", opacity:i%2===0?1:0 }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"flex", gap }}>
          {Array.from({length:WEEKS}).map((_,wi)=>(
            <div key={wi} style={{ display:"flex", flexDirection:"column", gap }}>
              {[1,2,3,4,5,6,0].map(dow=>{
                const cell = days.find(d=>d.week===(WEEKS-1-wi)&&d.day===dow);
                if (!cell) return <div key={dow} style={{ width:cs, height:cs }}/>;
                return <div key={dow} onMouseEnter={()=>setHov(cell)} onMouseLeave={()=>setHov(null)}
                  style={{ width:cs, height:cs, borderRadius:3, background:heatColor(cell.v,cell.type), cursor:cell.v?"pointer":"default", border:hov?.date===cell.date&&cell.v?"1px solid #fff":"1px solid transparent" }}/>;
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:10 }}>
        <span style={{ fontSize:9, color:MUTED }}>Less</span>
        {[0,1,2,3,4].map(v=><div key={v} style={{ width:10, height:10, borderRadius:2, background:heatColor(v,"run") }}/>)}
        <span style={{ fontSize:9, color:MUTED }}>More</span>
        {hov?.v>0 && <span style={{ marginLeft:12, fontSize:10, color:TEXT, background:SEP, padding:"2px 8px", borderRadius:4 }}>{hov.label} · {hov.type==="run"?"🏃":"🚴"} · {["","Easy","Moderate","Hard","Peak"][hov.v]}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [status, setStatus]   = useState("loading"); // loading | ready | error
  const [refreshing, setRef]  = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError]     = useState(null);
  const [dash, setDash]       = useState(null);
  const [metric, setMetric]   = useState("Distance");
  const [period, setPeriod]   = useState("Weekly");
  const [showRun, setShowRun] = useState(true);
  const [showRide, setShowRide] = useState(true);
  const [tab, setTab]         = useState("overview");
  const [selected, setSelected] = useState(null);

  const build = ({ activities, athlete }) => ({ ...computeDashboard(activities), athlete });

  async function fetchLive(bg = false) {
    if (!bg) { setStatus("loading"); setError(null); }
    else setRef(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: `Use Strava MCP to get the athlete's last 30 activities. Return ONLY valid JSON, no markdown:
{"athlete_name":"string","activities":[{"id":"string","name":"string","sport_type":"Run|Ride|Walk","date":"YYYY-MM-DD","distance_km":0,"moving_time_min":0,"elevation_m":0,"relative_effort":0,"calories":0,"pr_count":0}]}`,
          messages: [{ role:"user", content:"Get my last 30 Strava activities as JSON." }],
          mcp_servers: [{ type:"url", url:"https://mcp.strava.com/mcp", name:"strava" }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "API error");
      const parsed = extractJson(json.content.filter(b=>b.type==="text").map(b=>b.text).join(""));
      if (!Array.isArray(parsed.activities)) throw new Error("Response missing activities");
      const data = { activities: parsed.activities, athlete: parsed.athlete_name };
      await cacheSet(data);
      setDash(build(data)); setFromCache(false); setFetchedAt(new Date()); setStatus("ready");
    } catch(e) {
      if (!bg) { setError(e.message); setStatus("error"); }
    } finally { setRef(false); }
  }

  useEffect(() => {
    (async () => {
      // 1. Render seed data INSTANTLY — no waiting
      setDash(build({ activities: SEED_ACTIVITIES, athlete: "Adrian Schneider" }));
      setFromCache(true); setFetchedAt(new Date(SEED_TS)); setStatus("ready");

      // 2. If a newer cache exists, use it
      const cached = await cacheGet();
      if (cached && cached.ts > SEED_TS) {
        setDash(build(cached.data)); setFetchedAt(new Date(cached.ts));
        if (!cached.stale) return; // cache is fresh, no fetch needed
      }

      // 3. Refresh silently in background
      fetchLive(true);
    })();
  }, []);

  if (status === "loading") return (
    <div style={{ background:BG, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontFamily:"system-ui" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:40, height:40, border:`3px solid ${SEP}`, borderTop:`3px solid ${ORANGE}`, borderRadius:"50%", animation:"spin 1s linear infinite" }}/>
      <p style={{ color:MUTED, fontSize:13 }}>Fetching your Strava activities...</p>
    </div>
  );

  if (status === "error") return (
    <div style={{ background:BG, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontFamily:"system-ui", padding:24 }}>
      <p style={{ color:"#f87171", fontSize:14, textAlign:"center" }}>⚠️ {error}</p>
      <button onClick={()=>fetchLive(false)} style={{ background:ORANGE, color:"#fff", border:"none", borderRadius:10, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer" }}>Retry</button>
    </div>
  );

  const { recent, total, weekRun, weekRide, weekTime, weekSessions, monKm, prevKm, streak, wChart, mChart, calDays, athlete } = dash;
  const daysLeft = daysToRace();
  const raceDone = daysLeft < 0;
  const activeChart = period === "Monthly" ? mChart : wChart;
  const chartData = activeChart[metric];
  const unit = { Distance:"km", Time:"min", "Elev Gain":"m" }[metric];
  const maxVal = Math.max(1,...chartData.flatMap(d=>[showRun?d.run:0,showRide?d.ride:0]));
  const yMax = Math.ceil(maxVal*1.15);
  const now = new Date();
  const monLabel = now.toLocaleDateString("en-AU",{month:"short"});
  const prevLabel = new Date(now.getFullYear(),now.getMonth()-1,1).toLocaleDateString("en-AU",{month:"short"});
  const monDiff = +(monKm-prevKm).toFixed(1);

  const kpis = [
    { label:"Weekly Distance", value:`${+(weekRun+weekRide).toFixed(1)}`, unit:"km", sub:`${weekRun} run · ${weekRide} ride`, color:BLUE, icon:"📏", subColor:"#4ade80" },
    { label:"Weekly Time", value:fmtTime(weekTime), unit:"", sub:`${weekSessions} session${weekSessions===1?"":"s"}`, color:"#a78bfa", icon:"⏱️", subColor:"#4ade80" },
    { label:"Current Streak", value:`${streak}`, unit:"days", sub:"consecutive active days", color:ORANGE, icon:"🔥", subColor:"#4ade80" },
    { label:`${monLabel} Distance`, value:`${monKm}`, unit:`km · ${monLabel} 1–${now.getDate()}`, sub:`${monKm>=prevKm?"↑":"↓"} ${Math.abs(monDiff)} km vs ${prevLabel} 1–${now.getDate()} (${prevKm} km)`, color:GREEN, icon:"📅", subColor:monKm>=prevKm?"#4ade80":"#f87171" },
    { label:"VO₂ Max", value:"48.0", unit:"ml/kg/min", sub:"↓ from 49.3 peak", color:"#f59e0b", icon:"❤️", subColor:"#f87171" },
  ];

  return (
    <div style={{ background:BG, minHeight:"100vh", fontFamily:"system-ui, sans-serif", color:TEXT, paddingBottom:40 }}>
      {/* Header */}
      <div style={{ padding:"24px 20px 0", borderBottom:`1px solid ${SEP}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:"-0.02em" }}>Training</h1>
            <p style={{ margin:"2px 0 0", fontSize:12, color:MUTED }}>{athlete} · Sydney Marathon 30 Aug 2026</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <div style={{ background:CARD, borderRadius:10, padding:"6px 12px", textAlign:"center", border:`1px solid ${ORANGE}33` }}>
              <p style={{ margin:0, fontSize:20, fontWeight:800, color:ORANGE, lineHeight:1 }}>{raceDone ? "🏅" : daysLeft}</p>
              <p style={{ margin:0, fontSize:9, color:MUTED }}>{raceDone ? "RACE DONE" : daysLeft === 0 ? "RACE DAY" : "DAYS LEFT"}</p>
            </div>
            <button onClick={()=>fetchLive(true)} disabled={refreshing} style={{ background:SEP, border:"none", borderRadius:8, color:TEXT, cursor:refreshing?"default":"pointer", fontSize:11, padding:"4px 10px" }}>
              {refreshing?"↻ Updating...":"↻ Refresh"}
            </button>
            {fetchedAt && <p style={{ margin:0, fontSize:9, color:MUTED }}>{fromCache&&!refreshing?"⚡ Cached":"🔄 Live"} · {fetchedAt.toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"})}</p>}
          </div>
        </div>
        <div style={{ display:"flex", borderTop:`1px solid ${SEP}`, marginTop:12 }}>
          {["overview","fitness","vo₂ max"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ background:"none", border:"none", cursor:"pointer", padding:"10px 16px", fontSize:12, fontWeight:600, color:tab===t?TEXT:MUTED, textTransform:"capitalize", borderBottom:tab===t?`2px solid ${ORANGE}`:"2px solid transparent" }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 20px 0" }}>
        {tab==="overview" && (<>
          {/* KPIs */}
          <p style={{ margin:"0 0 12px", fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase" }}>Key Metrics</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:28 }}>
            {kpis.slice(0,4).map((k,i)=><KpiCard key={i} {...k}/>)}
            <div style={{ gridColumn:"1/-1" }}><KpiCard {...kpis[4]}/></div>
          </div>

          {/* Calendar */}
          <CalendarHeatmap days={calDays}/>

          {/* Chart */}
          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
            <TabBar options={["Distance","Time","Elev Gain"]} active={metric} onSelect={m=>{setMetric(m);setSelected(null);}} style={{ flex:1 }}/>
            <TabBar options={["Weekly","Monthly"]} active={period} onSelect={p=>{setPeriod(p);setSelected(null);}} style={{ width:148, flexShrink:0 }}/>
          </div>
          <div style={{ display:"flex", gap:16, marginBottom:12 }}>
            {[[BLUE,"Run",showRun,setShowRun],[ORANGE,"Ride",showRide,setShowRide]].map(([c,l,show,set])=>(
              <button key={l} onClick={()=>set(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:show?c:"#444" }}/>
                <span style={{ fontSize:12, color:show?TEXT:MUTED }}>{l}</span>
              </button>
            ))}
          </div>
          <div style={{ background:CARD, borderRadius:14, padding:"16px 8px 8px", marginBottom:8, border:`1px solid ${SEP}` }}>
            <div style={{ display:"flex", justifyContent:"flex-end", paddingRight:16, marginBottom:4 }}>
              <span style={{ fontSize:9, color:MUTED }}>Scale: 0–{yMax} {unit}</span>
            </div>
            <ResponsiveContainer width="100%" height={190} key={`${metric}-${period}`}>
              <BarChart data={chartData} barGap={2} margin={{ top:0, right:8, left:-16, bottom:0 }} onClick={d=>d?.activeLabel&&setSelected(s=>s===d.activeLabel?null:d.activeLabel)} style={{ cursor:"pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:10, fill:MUTED }} axisLine={false} tickLine={false} unit={` ${unit}`} domain={[0,yMax]}/>
                <Tooltip contentStyle={{ background:"#2c2c2e", border:"none", borderRadius:8, color:TEXT, fontSize:12 }} labelStyle={{ color:MUTED }} cursor={{ fill:"rgba(255,255,255,0.05)" }} formatter={(v,n)=>[`${v} ${unit}`,n]}/>
                {showRun && <Bar dataKey="run" name="Run" radius={[4,4,0,0]} maxBarSize={28} isAnimationActive animationDuration={700}>
                  {chartData.map(d=><Cell key={d.label} fill={selected===d.label?"#93c5fd":BLUE} opacity={selected&&selected!==d.label?0.4:1}/>)}
                </Bar>}
                {showRide && <Bar dataKey="ride" name="Ride" radius={[4,4,0,0]} maxBarSize={28} isAnimationActive animationDuration={700}>
                  {chartData.map(d=><Cell key={d.label} fill={selected===d.label?"#fb923c":ORANGE} opacity={selected&&selected!==d.label?0.4:1}/>)}
                </Bar>}
              </BarChart>
            </ResponsiveContainer>
            <p style={{ margin:"6px 0 0", textAlign:"center", fontSize:10, color:MUTED }}>Tap a bar to drill in</p>
          </div>

          {/* Drill-down (shows the currently selected metric, not always distance) */}
          {selected && (() => {
            const w = chartData.find(d=>d.label===selected);
            if (!w) return null;
            const fmt = v => metric==="Distance" ? +v.toFixed(1) : Math.round(v);
            return (
              <div style={{ background:"linear-gradient(135deg,#1a2540,#0f1624)", borderRadius:12, padding:"16px 18px", marginBottom:12, border:`1px solid ${BLUE}44` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:700 }}>{period === "Monthly" ? selected : `Week of ${selected}`}</p>
                  <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:16 }}>✕</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[{l:"Run",v:fmt(w.run),c:BLUE},{l:"Ride",v:fmt(w.ride),c:ORANGE},{l:"Total",v:fmt(w.run+w.ride),c:TEXT}].map((s,i)=>(
                    <div key={i} style={{ background:"#0d1117", borderRadius:8, padding:10, textAlign:"center" }}>
                      <p style={{ margin:"0 0 3px", fontSize:9, color:MUTED }}>{s.l} {unit}</p>
                      <p style={{ margin:0, fontSize:18, fontWeight:800, color:s.c }}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Stats grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:SEP, borderRadius:14, overflow:"hidden", marginBottom:24, border:`1px solid ${SEP}` }}>
            {[
              { t:"This Week", rows:[{l:"Run",v:`${weekRun} km`},{l:"Ride",v:`${weekRide} km`},{l:"Time",v:fmtTime(weekTime)}] },
              { t:`${monLabel} Total`, rows:[{l:"Distance",v:`${monKm} km`},{l:"vs last month",v:`${monDiff>=0?"+":""}${monDiff} km`},{l:"Streak",v:`${streak} days`}] },
              { t:"Race", rows:[{l:raceDone?"Days since":"Days left",v:`${Math.abs(daysLeft)}`},{l:"Race date",v:"30 Aug 2026"},{l:"Activities",v:`${total}`}] },
            ].map((col,i)=>(
              <div key={i} style={{ background:CARD, padding:"14px 12px" }}>
                <p style={{ margin:"0 0 10px", fontSize:10, color:MUTED, letterSpacing:"0.06em", textTransform:"uppercase", fontWeight:600 }}>{col.t}</p>
                {col.rows.map((r,j)=>(
                  <div key={j} style={{ marginBottom:8 }}>
                    <p style={{ margin:"0 0 1px", fontSize:9, color:MUTED }}>{r.l}</p>
                    <p style={{ margin:0, fontSize:13, fontWeight:700 }}>{r.v}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Quote */}
          <div style={{ background:"linear-gradient(135deg,#1a1f3a,#0f1624)", borderRadius:14, padding:20, marginBottom:24, border:"1px solid #2a3560", position:"relative" }}>
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:`linear-gradient(180deg,${ORANGE},#a78bfa)`, borderRadius:"14px 0 0 14px" }}/>
            <p style={{ margin:"0 0 8px", fontSize:14, color:TEXT, lineHeight:1.6, fontStyle:"italic", paddingLeft:12 }}>
              {raceDone
                ? `"The race is run. Recover well, then pick the next start line."`
                : `"${daysLeft} days. Every session you do now is a deposit. Race day is the withdrawal."`}
            </p>
            <p style={{ margin:0, fontSize:11, color:MUTED, paddingLeft:12 }}>— Coach Brief</p>
          </div>

          {/* Recent activities */}
          <p style={{ margin:"0 0 12px", fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase" }}>Recent Activities</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {recent.map(a=>(
              <div key={a.id} style={{ background:CARD, borderRadius:12, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${SEP}` }}>
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:SEP, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                    {a.sport_type==="Run"?"🏃":a.sport_type==="Ride"?"🚴":"🚶"}
                  </div>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <p style={{ margin:0, fontWeight:600, fontSize:14 }}>{a.name}</p>
                      {a.pr_count>0 && <span style={{ fontSize:11 }}>🏆 {a.pr_count} PR{a.pr_count>1?"s":""}</span>}
                      {(a.relative_effort||0)>120 && <span style={{ fontSize:11 }}>🔥</span>}
                    </div>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:MUTED }}>{fmtDate(a.date)} · {fmtTime(a.moving_time_min)}</p>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ margin:0, fontSize:16, fontWeight:800, color:(a.relative_effort||0)>100?ORANGE:TEXT }}>{(a.distance_km||0).toFixed(1)} km</p>
                  {a.relative_effort>0 && <p style={{ margin:"2px 0 0", fontSize:11, color:MUTED }}>RE {a.relative_effort}</p>}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {tab==="fitness" && (
          <div style={{ background:CARD, borderRadius:14, padding:"20px 18px", border:`1px solid ${SEP}` }}>
            <p style={{ margin:"0 0 12px", fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase" }}>Fitness Trend</p>
            <p style={{ color:MUTED, fontSize:13 }}>Heart rate data required for CTL/ATL/TSB tracking. Connect a HR monitor to Strava to enable.</p>
          </div>
        )}

        {tab==="vo₂ max" && (
          <div style={{ background:CARD, borderRadius:14, padding:"20px 18px", border:`1px solid ${SEP}` }}>
            <p style={{ margin:"0 0 12px", fontSize:11, color:MUTED, letterSpacing:"0.1em", textTransform:"uppercase" }}>VO₂ Max Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={[{d:"Jan",v:44.2},{d:"Feb",v:46.1},{d:"Mar",v:48.5},{d:"Apr",v:49.3},{d:"May 1",v:48.1},{d:"May 15",v:46.8},{d:"Jun 1",v:47.2},{d:"Jun 10",v:47.8},{d:"Jun 24",v:48.0}]} margin={{top:8,right:8,left:-20,bottom:0}}>
                <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2e" vertical={false}/>
                <XAxis dataKey="d" tick={{fontSize:9,fill:MUTED}} axisLine={false} tickLine={false}/>
                <YAxis domain={[43,51]} tick={{fontSize:9,fill:MUTED}} axisLine={false} tickLine={false}/>
                <ReferenceLine y={49.3} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5}/>
                <Tooltip contentStyle={{background:"#2c2c2e",border:"none",borderRadius:8,color:TEXT,fontSize:11}} formatter={v=>[`${v} ml/kg/min`,"VO₂ Max"]}/>
                <Area type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={2.5} fill="url(#vg)" dot={{fill:"#f59e0b",r:3}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
