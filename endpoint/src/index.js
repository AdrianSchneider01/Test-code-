// mtr-results: collects daily test results from MTRs and the camera observer,
// and sends the daily report email itself (so it arrives even when a room or
// the observer machine is off).
//
//   POST /results          Authorization: Bearer <REPORT_TOKEN>   body: JSON result
//   GET  /results?since=   Authorization: Bearer <READ_TOKEN>     ISO time, default last 24 h
//   GET  /report/preview   Authorization: Bearer <READ_TOKEN>     today's report as HTML
//   POST /report/send      Authorization: Bearer <READ_TOKEN>     send today's report now
//   GET  /health           no auth
//   cron                   sends the report when it is REPORT_HOUR:xx in TZ_NAME
//
// Result body: { room, source: "mtr"|"observer", status, message, details? }

import { buildReport, localTime } from "./report.js";
import { sendMail } from "./smtp.js";

const MAX_BODY = 64 * 1024;
const SOURCES = ["mtr", "observer"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Constant-time compare so tokens can't be guessed by timing
function sameToken(given, expected) {
  // Secrets piped in from Windows can carry a trailing \r\n
  expected = (expected || "").trim();
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function bearer(request) {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function postResult(request, env) {
  if (!sameToken(bearer(request), env.REPORT_TOKEN)) return json({ error: "unauthorized" }, 401);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "body too large" }, 413);

  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "invalid JSON" }, 400); }

  const room = String(body.room || "").trim().slice(0, 100);
  const source = String(body.source || "").trim();
  const status = String(body.status || "").trim().toUpperCase().slice(0, 20);
  if (!room || !SOURCES.includes(source) || !status) {
    return json({ error: "room, source (mtr|observer) and status are required" }, 400);
  }

  const message = String(body.message || "").slice(0, 2000);
  const details = body.details === undefined ? null : JSON.stringify(body.details).slice(0, 32000);
  const receivedAt = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO results (room, source, status, message, details, received_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(room, source, status, message, details, receivedAt).run();

  return json({ ok: true, receivedAt });
}

async function getResults(request, env) {
  if (!sameToken(bearer(request), env.READ_TOKEN)) return json({ error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 3600 * 1000);
  if (isNaN(since)) return json({ error: "since must be an ISO date/time" }, 400);

  const { results } = await env.DB.prepare(
    "SELECT room, source, status, message, details, received_at FROM results WHERE received_at >= ? ORDER BY received_at"
  ).bind(since.toISOString()).all();

  return json({
    since: since.toISOString(),
    results: results.map(r => ({ ...r, details: r.details ? JSON.parse(r.details) : null })),
  });
}

async function todaysReport(env, now = new Date()) {
  const since = new Date(now.getTime() - 36 * 3600 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT room, source, status, message, received_at FROM results WHERE received_at >= ? ORDER BY received_at"
  ).bind(since).all();
  return buildReport(results, env.EXPECTED_ROOMS || [], now, env.TZ_NAME);
}

async function sendReport(env) {
  const report = await todaysReport(env);
  const transcript = await sendMail(
    { host: env.SMTP_HOST, port: Number(env.SMTP_PORT), user: env.SMTP_USER,
      password: (env.SMTP_PASSWORD || "").trim(), helo: env.SMTP_HELO },
    { from: env.MAIL_FROM, to: env.MAIL_TO, subject: report.subject, html: report.html });
  console.log(JSON.stringify({ event: "report_sent", subject: report.subject, transcript }));
  return report;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/health") return json({ ok: true });
      if (pathname === "/results" && request.method === "POST") return await postResult(request, env);
      if (pathname === "/results" && request.method === "GET") return await getResults(request, env);
      if (pathname.startsWith("/report/")) {
        if (!sameToken(bearer(request), env.READ_TOKEN)) return json({ error: "unauthorized" }, 401);
        if (pathname === "/report/preview" && request.method === "GET") {
          const r = await todaysReport(env);
          return new Response(r.html, { headers: { "content-type": "text/html; charset=utf-8", "x-subject": r.subject } });
        }
        if (pathname === "/report/send" && request.method === "POST") {
          const r = await sendReport(env);
          return json({ ok: true, subject: r.subject, to: env.MAIL_TO });
        }
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error(JSON.stringify({ event: "error", path: pathname, error: String(err) }));
      return json({ error: "internal error", detail: String(err).slice(0, 300) }, 500);
    }
  },

  // Cron runs at two UTC times so one of them is REPORT_HOUR local in both
  // daylight-saving and standard time; only that one sends.
  async scheduled(controller, env, ctx) {
    const hour = localTime(new Date(controller.scheduledTime), env.TZ_NAME).slice(0, 2);
    if (hour !== env.REPORT_HOUR) {
      console.log(JSON.stringify({ event: "report_skipped", localHour: hour }));
      return;
    }
    ctx.waitUntil(sendReport(env).catch((err) =>
      console.error(JSON.stringify({ event: "report_failed", error: String(err) }))));
  },
};
