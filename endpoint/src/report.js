// Daily report: pairs each expected room's MTR result with its observer (camera)
// result for "today" in the report time zone, and flags rooms that never reported.

const COLOUR = { PASS: "#1a7f37", WARN: "#9a6700", FAIL: "#cf222e", MISSING: "#cf222e" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function localDate(d, tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function localTime(d, tz) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/**
 * @param {Array<{room,source,status,message,received_at}>} results  recent results (any day)
 * @param {string[]} expectedRooms
 * @param {Date} now
 * @param {string} tz  e.g. "Australia/Sydney"
 */
export function buildReport(results, expectedRooms, now, tz) {
  const today = localDate(now, tz);
  const todays = results.filter((r) => localDate(new Date(r.received_at), tz) === today);
  const latest = (room, source) =>
    todays.filter((r) => r.room === room && r.source === source).at(-1);

  const rooms = [...new Set([...expectedRooms, ...todays.map((r) => r.room)])].sort();
  const rows = rooms.map((room) => {
    const mtr = latest(room, "mtr");
    const obs = latest(room, "observer");
    let overall;
    if (!mtr) overall = "MISSING";
    else if (mtr.status === "FAIL") overall = "FAIL";
    else if (!obs || obs.status !== "LIVE") overall = "FAIL";
    else if (mtr.status === "WARN") overall = "WARN";
    else overall = "PASS";
    return {
      room,
      overall,
      time: mtr ? localTime(new Date(mtr.received_at), tz) : "",
      call: mtr ? `${mtr.status}: ${mtr.message}`
                : "No result from the room: MTR off or offline, its test task did not run, or it has no internet access",
      camera: obs ? `${obs.status}: ${obs.message}`
                  : "Camera not checked: the observer did not report (central machine off, asleep or offline?)",
    };
  });

  const counts = ["PASS", "WARN", "FAIL", "MISSING"].map((s) => `${rows.filter((r) => r.overall === s).length} ${s}`).join(", ");
  const subject = `MTR daily test ${today}: ${counts}`;
  const noObserver = rooms.length > 0 && !todays.some((r) => r.source === "observer");

  const td = "padding:6px 10px;border-bottom:1px solid #ddd;vertical-align:top";
  const tr = rows.map((r) =>
    `<tr><td style='${td}'><b>${esc(r.room)}</b></td>` +
    `<td style='${td};color:${COLOUR[r.overall]};font-weight:bold'>${r.overall}</td>` +
    `<td style='${td}'>${esc(r.time)}</td><td style='${td}'>${esc(r.call)}</td><td style='${td}'>${esc(r.camera)}</td></tr>`
  ).join("\n") || `<tr><td colspan='5' style='padding:6px 10px'>No rooms configured and no results received today.</td></tr>`;

  const banner = noObserver
    ? `<p style='margin:0 0 12px;padding:8px 10px;background:#fff1f0;border:1px solid #cf222e;color:#cf222e'><b>No camera checks ran today.</b> The central observer machine did not report at all; check it is on, awake and logged in.</p>`
    : "";

  const html = `<html><body style='font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222'>
<h2 style='margin:0 0 4px'>MTR daily test call</h2>
<p style='margin:0 0 12px;color:#555'>${esc(counts)} &middot; ${esc(today)} (${esc(tz)})</p>
${banner}
<table style='border-collapse:collapse'>
<tr style='background:#f3f3f3;text-align:left'><th style='padding:6px 10px'>Room</th><th style='padding:6px 10px'>Result</th><th style='padding:6px 10px'>Time</th><th style='padding:6px 10px'>Test call (room)</th><th style='padding:6px 10px'>Camera (observer)</th></tr>
${tr}
</table>
<p style='color:#777;font-size:12px'>PASS = joined, live camera picture on the room's tile, left and back on home. WARN = same, with hardware warnings (see the Teams Rooms Pro portal). FAIL = the call or camera check failed, or the camera was not checked. MISSING = no result from the room today. Sent by the mtr-results Worker.</p>
</body></html>`;

  return { subject, html, rows, today };
}
