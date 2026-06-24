import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine, Area, AreaChart
} from "recharts";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG     = "#000";
const CARD   = "#1c1c1e";
const BLUE   = "#4a9eff";
const ORANGE = "#f4511e";
const GREEN  = "#10b981";
const TEXT   = "#fff";
const MUTED  = "#8e8e93";
const SEP    = "#2c2c2e";
const DAYS_TO_RACE = 67;

// ── Chart Data ────────────────────────────────────────────────────────────────
const WEEKLY_DATA = {
  Distance: [
    { label: "Apr 21", run: 0,    ride: 0 },
    { label: "Apr 28", run: 0,    ride: 21.7 },
    { label: "May 5",  run: 0,    ride: 47.3 },
    { label: "May 12", run: 0,    ride: 0 },
    { label: "May 19", run: 2.8,  ride: 0 },
    { label: "May 26", run: 11.5, ride: 10.4 },
    { label: "Jun 2",  run: 6.4,  ride: 14.1 },
    { label: "Jun 9",  run: 13.0, ride: 18.0 },
    { label: "Jun 16", run: 19.3, ride: 65.4 },
    { label: "Jun 23", run: 7.7,  ride: 0 },
  ],
  Time: [
    { label: "Apr 21", run: 0,   ride: 0 },
    { label: "Apr 28", run: 0,   ride: 52 },
    { label: "May 5",  run: 0,   ride: 108 },
    { label: "May 12", run: 0,   ride: 0 },
    { label: "May 19", run: 19,  ride: 0 },
    { label: "May 26", run: 78,  ride: 24 },
    { label: "Jun 2",  run: 44,  ride: 32 },
    { label: "Jun 9",  run: 90,  ride: 42 },
    { label: "Jun 16", run: 132, ride: 148 },
    { label: "Jun 23", run: 53,  ride: 0 },
  ],
  "Elev Gain": [
    { label: "Apr 21", run: 0,   ride: 0 },
    { label: "Apr 28", run: 0,   ride: 180 },
    { label: "May 5",  run: 0,   ride: 390 },
    { label: "May 12", run: 0,   ride: 0 },
    { label: "May 19", run: 22,  ride: 0 },
    { label: "May 26", run: 85,  ride: 88 },
    { label: "Jun 2",  run: 48,  ride: 115 },
    { label: "Jun 9",  run: 96,  ride: 145 },
    { label: "Jun 16", run: 142, ride: 530 },
    { label: "Jun 23", run: 58,  ride: 0 },
  ],
};

const MONTHLY_DATA = {
  Distance: [
    { label: "Jan", run: 0,  ride: 12 },
    { label: "Feb", run: 48, ride: 32 },
    { label: "Mar", run: 62, ride: 45 },
    { label: "Apr", run: 28, ride: 68 },
    { label: "May", run: 20, ride: 80 },
    { label: "Jun", run: 46, ride: 97 },
  ],
  Time: [
    { label: "Jan", run: 0,   ride: 28 },
    { label: "Feb", run: 328, ride: 74 },
    { label: "Mar", run: 425, ride: 104 },
    { label: "Apr", run: 192, ride: 158 },
    { label: "May", run: 141, ride: 186 },
    { label: "Jun", run: 312, ride: 222 },
  ],
  "Elev Gain": [
    { label: "Jan", run: 0,   ride: 94 },
    { label: "Feb", run: 360, ride: 248 },
    { label: "Mar", run: 462, ride: 348 },
    { label: "Apr", run: 210, ride: 528 },
    { label: "May", run: 155, ride: 620 },
    { label: "Jun", run: 429, ride: 758 },
  ],
};

// ── Calendar Heatmap Data (Apr–Jun, daily effort 0–4) ─────────────────────────
// 0=rest, 1=light, 2=moderate, 3=hard, 4=peak
const generateCalendar = () => {
  const days = [];
  const entries = {
    // April rides
    "2026-04-28": { v: 2, type: "ride" }, "2026-04-29": { v: 2, type: "ride" },
    "2026-05-02": { v: 2, type: "ride" }, "2026-05-03": { v: 2, type: "ride" },
    "2026-05-05": { v: 2, type: "ride" },
    // May injury rest then return
    "2026-05-23": { v: 1, type: "run" },
    "2026-05-24": { v: 1, type: "run" },
    "2026-05-25": { v: 1, type: "ride" },
    "2026-05-27": { v: 2, type: "run" },
    "2026-05-30": { v: 2, type: "run" },
    "2026-05-31": { v: 1, type: "ride" },
    // June
    "2026-06-03": { v: 2, type: "run" },
    "2026-06-06": { v: 2, type: "run" },
    "2026-06-07": { v: 2, type: "run" },
    "2026-06-08": { v: 1, type: "ride" },
    "2026-06-10": { v: 2, type: "run" },
    "2026-06-11": { v: 1, type: "ride" },
    "2026-06-12": { v: 2, type: "run" },
    "2026-06-13": { v: 1, type: "ride" },
    "2026-06-14": { v: 2, type: "run" },
    "2026-06-16": { v: 1, type: "ride" },
    "2026-06-17": { v: 2, type: "run" },
    "2026-06-19": { v: 2, type: "ride" },
    "2026-06-20": { v: 4, type: "run" },  // peak effort
  };

  const start = new Date("2026-04-06"); // start on Monday
  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().split("T")[0];
    days.push({
      date: key,
      day: d.getDay(),
      week: Math.floor(i / 7),
      label: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      ...(entries[key] || { v: 0, type: null }),
    });
  }
  return days;
};

const CALENDAR_DAYS = generateCalendar();
const WEEKS = 12;

// Week labels
const WEEK_LABELS = ["Apr 6", "Apr 13", "Apr 20", "Apr 27", "May 4", "May 11",
  "May 18", "May 25", "Jun 1", "Jun 8", "Jun 15", "Jun 22"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// ── Fitness Trend (TrainingPeaks CTL/ATL/TSB style) ──────────────────────────
const FITNESS_TREND = [
  // Jan — base building
  { date: "Jan 1",  ctl: 18, atl: 14, tsb: 4  },
  { date: "Jan 8",  ctl: 21, atl: 26, tsb: -5 },
  { date: "Jan 15", ctl: 24, atl: 28, tsb: -4 },
  { date: "Jan 22", ctl: 27, atl: 24, tsb: 3  },
  { date: "Jan 29", ctl: 29, atl: 30, tsb: -1 },
  // Feb — building
  { date: "Feb 5",  ctl: 31, atl: 34, tsb: -3 },
  { date: "Feb 12", ctl: 33, atl: 36, tsb: -3 },
  { date: "Feb 19", ctl: 35, atl: 32, tsb: 3  },
  { date: "Feb 26", ctl: 37, atl: 38, tsb: -1 },
  // Mar — peak block
  { date: "Mar 5",  ctl: 39, atl: 44, tsb: -5 },
  { date: "Mar 12", ctl: 41, atl: 46, tsb: -5 },
  { date: "Mar 19", ctl: 42, atl: 40, tsb: 2  },
  { date: "Mar 26", ctl: 43, atl: 42, tsb: 1  },
  // Apr — peak fitness
  { date: "Apr 1",  ctl: 42, atl: 38, tsb: 4  },
  { date: "Apr 8",  ctl: 44, atl: 46, tsb: -2 },
  { date: "Apr 15", ctl: 46, atl: 50, tsb: -4 },
  { date: "Apr 22", ctl: 45, atl: 42, tsb: 3  },
  { date: "Apr 29", ctl: 43, atl: 40, tsb: 3  },
  // Injury — load drops
  { date: "May 6",  ctl: 38, atl: 28, tsb: 10 },
  { date: "May 13", ctl: 32, atl: 18, tsb: 14 },
  { date: "May 20", ctl: 27, atl: 14, tsb: 13 },
  // Return to run — ATL rising
  { date: "May 27", ctl: 26, atl: 22, tsb: 4  },
  { date: "Jun 3",  ctl: 27, atl: 28, tsb: -1 },
  { date: "Jun 10", ctl: 29, atl: 32, tsb: -3 },
  { date: "Jun 17", ctl: 31, atl: 36, tsb: -5 },
  { date: "Jun 24", ctl: 33, atl: 38, tsb: -5 },
];

// ── VO₂ Max Trend ─────────────────────────────────────────────────────────────
const VO2_TREND = [
  { date: "Jan",    vo2: 44.2 },
  { date: "Feb",    vo2: 46.1 },
  { date: "Mar",    vo2: 48.5 },
  { date: "Apr 1",  vo2: 49.0 },
  { date: "Apr 15", vo2: 49.3 },
  // Injury decline
  { date: "May 1",  vo2: 48.1 },
  { date: "May 15", vo2: 46.8 },
  // Return
  { date: "Jun 1",  vo2: 47.2 },
  { date: "Jun 10", vo2: 47.8 },
  { date: "Jun 24", vo2: 48.0 },
];

// ── Recent Activities ─────────────────────────────────────────────────────────
const RECENT_ACTIVITIES = [
  { emoji: "🏃", title: "Morning Run",  date: "Jun 20", km: 7.7,  time: "53:13", effort: 115, badge: "🔥" },
  { emoji: "🚴", title: "Morning Ride", date: "Jun 19", km: 25.7, time: "58:40", effort: 25,  badge: null },
  { emoji: "🚴", title: "Morning Ride", date: "Jun 19", km: 25.6, time: "57:22", effort: 24,  badge: null },
  { emoji: "🏃", title: "Easy Run",     date: "Jun 17", km: 6.4,  time: "44:10", effort: 76,  badge: null },
  { emoji: "🚴", title: "Morning Ride", date: "Jun 16", km: 21.8, time: "49:55", effort: 20,  badge: null },
];

const METRIC_UNITS = { Distance: "km", Time: "min", "Elev Gain": "m" };
const METRICS = ["Distance", "Time", "Elev Gain"];
const PERIODS  = ["Weekly", "Monthly"];

// Monthly Distance: Jun 1–24 vs May 1–24 (same 24 days)
const MONTHLY_DIST_NOW  = 46.3;
const MONTHLY_DIST_PREV = 7.9;
const MONTHLY_DIST_DIFF = (MONTHLY_DIST_NOW - MONTHLY_DIST_PREV).toFixed(1);
const MONTHLY_DIST_UP   = MONTHLY_DIST_NOW >= MONTHLY_DIST_PREV;

const KPI_CARDS = [
  { label: "Weekly Distance", value: "19.3", unit: "km",        sub: "↑ from 13.0",  color: BLUE,      icon: "📏", subColor: "#4ade80" },
  { label: "Weekly Time",     value: "3h 42", unit: "",         sub: "3 sessions",    color: "#a78bfa", icon: "⏱️", subColor: "#4ade80" },
  { label: "Current Streak",  value: "12",   unit: "days",      sub: "best: 14",      color: ORANGE,    icon: "🔥", subColor: "#4ade80" },
  {
    label: "Monthly Distance",
    value: `${MONTHLY_DIST_NOW}`,
    unit: "km · Jun 1–24",
    sub: `${MONTHLY_DIST_UP ? "↑" : "↓"} ${Math.abs(MONTHLY_DIST_DIFF)} km vs May 1–24 (${MONTHLY_DIST_PREV} km)`,
    subColor: MONTHLY_DIST_UP ? "#4ade80" : "#f87171",
    color: GREEN,
    icon: "📅",
  },
  { label: "VO₂ Max", value: "48.0", unit: "ml/kg/min", sub: "↓ from 49.3 peak", color: "#f59e0b", icon: "❤️", subColor: "#f87171" },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function TabBar({ options, active, onSelect, style = {} }) {
  return (
    <div style={{ display: "flex", background: "#2c2c2e", borderRadius: 8, padding: 2, ...style }}>
      {options.map(o => (
        <button key={o} onClick={() => onSelect(o)} style={{
          flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600,
          background: active === o ? "#fff" : "transparent",
          color: active === o ? "#000" : MUTED,
          border: "none", borderRadius: 6, cursor: "pointer",
          fontFamily: "system-ui", transition: "all 0.15s",
        }}>{o}</button>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p style={{ margin: "0 0 12px", fontSize: 11, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</p>;
}

function KpiCard({ label, value, unit, sub, color, icon, subColor }) {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: "16px 18px", border: `1px solid ${SEP}`, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: "system-ui", lineHeight: 1.3 }}>{label}</p>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <p style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 800, color, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
      {unit && <p style={{ margin: "0 0 6px", fontSize: 11, color: MUTED, fontFamily: "system-ui" }}>{unit}</p>}
      <p style={{ margin: 0, fontSize: 11, color: subColor || "#4ade80", fontFamily: "system-ui" }}>{sub}</p>
    </div>
  );
}

// Heatmap cell colors
function heatColor(v, type) {
  if (v === 0) return "#1c1c1e";
  const runColors  = ["#1c1c1e", "#1a3a5c", "#1e6ba8", "#2196f3", "#4a9eff"];
  const rideColors = ["#1c1c1e", "#3d1f0a", "#8b3a0f", "#c94b1a", "#f4511e"];
  return type === "run" ? runColors[v] : rideColors[v];
}

function CalendarHeatmap() {
  const [hoveredDay, setHoveredDay] = useState(null);
  const cellSize = 13;
  const gap = 3;

  return (
    <div style={{ background: CARD, borderRadius: 14, padding: "20px 18px", border: `1px solid ${SEP}`, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <SectionLabel>Activity Calendar</SectionLabel>
          <p style={{ margin: "-8px 0 0", fontSize: 13, color: TEXT, fontWeight: 600 }}>Apr – Jun 2026</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: "#2196f3" }} />
            <span style={{ fontSize: 10, color: MUTED }}>Run</span>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: ORANGE }} />
            <span style={{ fontSize: 10, color: MUTED }}>Ride</span>
          </div>
        </div>
      </div>

      {/* Week labels */}
      <div style={{ display: "flex", marginLeft: 20, marginBottom: 4, gap: gap }}>
        {WEEK_LABELS.map((wl, wi) => (
          <div key={wi} style={{ width: cellSize, fontSize: 8, color: MUTED, textAlign: "center", flexShrink: 0,
            overflow: "hidden", whiteSpace: "nowrap", opacity: wi % 2 === 0 ? 1 : 0 }}>
            {wi % 2 === 0 ? wl.split(" ")[0] : ""}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2 }}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: gap, marginRight: 4 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} style={{ height: cellSize, fontSize: 8, color: MUTED, display: "flex", alignItems: "center", opacity: i % 2 === 0 ? 1 : 0 }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: "flex", gap: gap }}>
          {Array.from({ length: WEEKS }).map((_, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: gap }}>
              {[1, 2, 3, 4, 5, 6, 0].map(dayOfWeek => {
                const cell = CALENDAR_DAYS.find(d => d.week === wi && d.day === dayOfWeek);
                if (!cell) return <div key={dayOfWeek} style={{ width: cellSize, height: cellSize }} />;
                return (
                  <div
                    key={dayOfWeek}
                    onMouseEnter={() => setHoveredDay(cell)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      width: cellSize, height: cellSize, borderRadius: 3,
                      background: heatColor(cell.v, cell.type),
                      cursor: cell.v > 0 ? "pointer" : "default",
                      border: hoveredDay?.date === cell.date && cell.v > 0 ? "1px solid #fff" : "1px solid transparent",
                      transition: "all 0.1s",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Intensity legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
        <span style={{ fontSize: 9, color: MUTED }}>Less</span>
        {[0,1,2,3,4].map(v => (
          <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(v, "run") }} />
        ))}
        <span style={{ fontSize: 9, color: MUTED }}>More</span>
        {hoveredDay?.v > 0 && (
          <span style={{ marginLeft: 12, fontSize: 10, color: TEXT, background: "#2c2c2e", padding: "2px 8px", borderRadius: 4 }}>
            {hoveredDay.label} · {hoveredDay.type === "run" ? "🏃 Run" : "🚴 Ride"} · {["", "Easy", "Moderate", "Hard", "Peak"][hoveredDay.v]}
          </span>
        )}
      </div>
    </div>
  );
}

function FitnessTrendChart() {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: "20px 18px", border: `1px solid ${SEP}`, marginBottom: 20 }}>
      <SectionLabel>Fitness Trend</SectionLabel>
      <p style={{ margin: "-8px 0 4px", fontSize: 13, color: TEXT, fontWeight: 600 }}>CTL · ATL · TSB — TrainingPeaks Style</p>
      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        {[
          { label: "Fitness (CTL)", color: BLUE, val: "33" },
          { label: "Fatigue (ATL)", color: "#f87171", val: "38" },
          { label: "Form (TSB)",    color: GREEN,  val: "-5" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 2, background: l.color, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: MUTED }}>{l.label}</span>
            <span style={{ fontSize: 11, color: l.color, fontWeight: 700 }}>{l.val}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={FITNESS_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2e" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={MUTED} strokeDasharray="3 3" strokeWidth={1} />
          <Tooltip
            contentStyle={{ background: "#2c2c2e", border: "none", borderRadius: 8, color: TEXT, fontSize: 11 }}
            labelStyle={{ color: MUTED }}
          />
          <Line type="monotone" dataKey="ctl" name="Fitness" stroke={BLUE}    strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="atl" name="Fatigue" stroke="#f87171" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="tsb" name="Form"    stroke={GREEN}   strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 12, padding: "10px 14px", background: "#0d1117", borderRadius: 8, borderLeft: `3px solid ${GREEN}` }}>
        <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
          <strong style={{ color: TEXT }}>Form (TSB) is negative</strong> — you're carrying fatigue. CTL dropped during injury and is rebuilding. Keep TSB above −10 to stay in the <span style={{ color: GREEN }}>productive zone</span>.
        </p>
      </div>
    </div>
  );
}

function VO2MaxTrend() {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: "20px 18px", border: `1px solid ${SEP}`, marginBottom: 20 }}>
      <SectionLabel>VO₂ Max Trend</SectionLabel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 13, color: TEXT, fontWeight: 600 }}>Jan – Jun 2026</p>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.03em", lineHeight: 1 }}>48.0</p>
          <p style={{ margin: 0, fontSize: 9, color: MUTED }}>ml/kg/min · current</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={VO2_TREND} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="vo2grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2e" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} />
          <YAxis domain={[43, 51]} tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} />
          <ReferenceLine y={49.3} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5}
            label={{ value: "Peak 49.3", fill: "#f59e0b", fontSize: 9, position: "insideTopRight" }} />
          <Tooltip
            contentStyle={{ background: "#2c2c2e", border: "none", borderRadius: 8, color: TEXT, fontSize: 11 }}
            formatter={(v) => [`${v} ml/kg/min`, "VO₂ Max"]}
          />
          <Area type="monotone" dataKey="vo2" name="VO₂ Max" stroke="#f59e0b" strokeWidth={2.5}
            fill="url(#vo2grad)" dot={{ fill: "#f59e0b", r: 3 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
        {[
          { label: "Jan baseline", val: "44.2", color: MUTED },
          { label: "Peak (Apr)", val: "49.3", color: "#f59e0b" },
          { label: "Injury loss", val: "−2.5", color: "#f87171" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#0d1117", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, color: MUTED }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUOTES = [
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", author: "John Bingham" },
  { text: "Run when you can, walk if you have to, crawl if you must — just never give up.", author: "Dean Karnazes" },
  { text: "Pain is temporary. Quitting lasts forever.", author: "Lance Armstrong" },
  { text: "Your body can do almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "The road to the finish line is paved with the miles you ran when you didn't want to.", author: "Unknown" },
  { text: "Don't dream of winning, train for it.", author: "Mo Farah" },
  { text: "Every morning in Africa, a gazelle wakes up knowing it must run faster than the lion or it will be killed. Every morning a lion wakes up knowing it must outrun the slowest gazelle or it will starve. It doesn't matter whether you are a lion or a gazelle — when the sun comes up, you'd better be running.", author: "African Proverb" },
  { text: "Believe in yourself, take on your challenges, dig deep within yourself to conquer fears.", author: "Chantal Sutherland" },
  { text: "I always loved running. It was something you could do by yourself, on your own terms.", author: "Billy Mills" },
  { text: "The hardest step for a runner is the one out the front door.", author: "George Sheehan" },
  { text: "Running is the greatest metaphor for life because you get out of it what you put into it.", author: "Oprah Winfrey" },
  { text: "There will be days you don't think you can run a marathon. There will be a lifetime knowing you have.", author: "Unknown" },
  { text: "Mental will is a muscle that needs exercise, just like the muscles of the body.", author: "Lynn Jennings" },
  { text: "Someone who is busier than you is running right now.", author: "Unknown" },
  { text: "67 days. Every run counts. Show up.", author: "Coach Brief" },
];

function MotivationQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [fade, setFade] = useState(true);
  const q = QUOTES[idx];

  const next = () => {
    setFade(false);
    setTimeout(() => {
      setIdx(i => (i + 1) % QUOTES.length);
      setFade(true);
    }, 200);
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1f3a 0%, #0f1624 100%)",
      borderRadius: 14, padding: "20px 20px", marginBottom: 24,
      border: "1px solid #2a3560", position: "relative", overflow: "hidden",
    }}>
      {/* accent line */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${ORANGE}, #a78bfa)`, borderRadius: "14px 0 0 14px" }} />
      <div style={{ paddingLeft: 12, opacity: fade ? 1 : 0, transition: "opacity 0.2s ease" }}>
        <p style={{ margin: "0 0 10px", fontSize: 9, color: "#818cf8", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "system-ui", fontWeight: 600 }}>Daily Motivation</p>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: TEXT, lineHeight: 1.6, fontStyle: "italic" }}>"{q.text}"</p>
        <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: "system-ui" }}>— {q.author}</p>
      </div>
      <button onClick={next} style={{
        position: "absolute", top: 14, right: 14,
        background: "#2a3560", border: "none", borderRadius: 8,
        color: MUTED, cursor: "pointer", fontSize: 14, padding: "4px 8px",
        fontFamily: "system-ui", lineHeight: 1,
      }} title="Next quote">↻</button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [metric, setMetric] = useState("Distance");
  const [period, setPeriod] = useState("Weekly");
  const [showRun,  setShowRun]  = useState(true);
  const [showRide, setShowRide] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const data = (period === "Weekly" ? WEEKLY_DATA : MONTHLY_DATA)[metric];
  const unit = METRIC_UNITS[metric];
  const totalRun  = data.reduce((s, d) => s + (d.run  || 0), 0);
  const totalRide = data.reduce((s, d) => s + (d.ride || 0), 0);
  const totalShown = (showRun ? totalRun : 0) + (showRide ? totalRide : 0);
  const totalLabel = metric === "Time"
    ? `${Math.floor(totalShown / 60)}h ${totalShown % 60}m`
    : `${totalShown.toFixed(1)} ${unit}`;

  const stats = {
    "Last 4 Weeks": [
      { label: "Avg Runs / Week", val: "3" },
      { label: "Avg Distance / Week", val: "16.1 km" },
      { label: "Avg Time / Week", val: "1h 52m" },
    ],
    "Year-to-Date": [
      { label: "Distance", val: "186 km" },
      { label: "Time", val: "22h 14m" },
      { label: "Runs", val: "28" },
    ],
    "All-Time": [
      { label: "Distance", val: "1,240 km" },
      { label: "Rides", val: "87" },
      { label: "Biggest Run", val: "21.1 km" },
    ],
  };

  const TABS = ["overview", "fitness", "vo₂ max"];

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: TEXT, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: "24px 20px 0", borderBottom: `1px solid ${SEP}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Training</h1>
          <div style={{ background: "#1c1c1e", borderRadius: 10, padding: "6px 12px", textAlign: "center", border: `1px solid ${ORANGE}33` }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: ORANGE, letterSpacing: "-0.04em", lineHeight: 1 }}>{DAYS_TO_RACE}</p>
            <p style={{ margin: 0, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>DAYS LEFT</p>
          </div>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED }}>Adrian Schneider · Sydney Marathon 30 Aug 2026</p>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${SEP}` }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "10px 16px",
              fontSize: 12, fontWeight: 600, fontFamily: "system-ui",
              color: activeTab === t ? TEXT : MUTED, textTransform: "capitalize",
              borderBottom: activeTab === t ? `2px solid ${ORANGE}` : "2px solid transparent",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {/* KPI Cards */}
            <SectionLabel>Key Metrics</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {KPI_CARDS.slice(0, 4).map((k, i) => <KpiCard key={i} {...k} />)}
              <div style={{ gridColumn: "1 / -1" }}><KpiCard {...KPI_CARDS[4]} /></div>
            </div>

            {/* Calendar Heatmap */}
            <CalendarHeatmap />

            {/* Chart toggles */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
              <TabBar options={METRICS} active={metric} onSelect={setMetric} style={{ flex: 1 }} />
              <TabBar options={PERIODS} active={period} onSelect={setPeriod} style={{ width: 148, flexShrink: 0 }} />
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <button onClick={() => setShowRun(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: showRun ? BLUE : "#444" }} />
                <span style={{ fontSize: 12, color: showRun ? TEXT : MUTED }}>Run</span>
              </button>
              <button onClick={() => setShowRide(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: showRide ? ORANGE : "#444" }} />
                <span style={{ fontSize: 12, color: showRide ? TEXT : MUTED }}>Ride</span>
              </button>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Total shown</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{totalLabel}</p>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ background: CARD, borderRadius: 14, padding: "16px 8px 8px", marginBottom: 20, border: `1px solid ${SEP}` }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} barGap={2} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} unit={` ${unit}`} />
                  <Tooltip
                    contentStyle={{ background: "#2c2c2e", border: "none", borderRadius: 8, color: TEXT, fontSize: 12 }}
                    labelStyle={{ color: MUTED }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(val, name) => [`${val} ${unit}`, name]}
                  />
                  {showRun  && <Bar dataKey="run"  name="Run"  fill={BLUE}   radius={[3,3,0,0]} maxBarSize={24} />}
                  {showRide && <Bar dataKey="ride" name="Ride" fill={ORANGE} radius={[3,3,0,0]} maxBarSize={24} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: SEP, borderRadius: 14, overflow: "hidden", marginBottom: 24, border: `1px solid ${SEP}` }}>
              {Object.entries(stats).map(([col, rows]) => (
                <div key={col} style={{ background: CARD, padding: "14px 12px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 10, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{col}</p>
                  {rows.map((r, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <p style={{ margin: "0 0 1px", fontSize: 9, color: MUTED }}>{r.label}</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{r.val}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Motivation Quote */}
            <MotivationQuote />

            {/* Recent Activities */}
            <SectionLabel>Recent Activities</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {RECENT_ACTIVITIES.map((a, i) => (
                <div key={i} style={{ background: CARD, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${SEP}` }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: SEP, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {a.emoji}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{a.title}</p>
                        {a.badge && <span style={{ fontSize: 12 }}>{a.badge}</span>}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{a.date} · {a.time}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: a.effort > 100 ? ORANGE : TEXT }}>{a.km} km</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>RE {a.effort}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FITNESS TAB ── */}
        {activeTab === "fitness" && <FitnessTrendChart />}

        {/* ── VO₂ MAX TAB ── */}
        {activeTab === "vo₂ max" && <VO2MaxTrend />}
      </div>
    </div>
  );
}
