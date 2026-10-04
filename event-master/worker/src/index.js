// Event Master Worker.
//
//   GET  /api/health      → { ok, ai }  (whether AI is configured)
//   POST /api/ai/:task    → { result }  (see src/ai/contract.js for tasks)
//   everything else       → the Expo web build (static assets, SPA fallback)
//
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret.

import Anthropic from '@anthropic-ai/sdk';

import { TASKS, sanitizeOutput, validateInput } from '../../src/ai/contract.js';
import { PROMPTS } from './prompts.js';

export const MODEL = 'claude-opus-5-5';
const MAX_BODY_BYTES = 24 * 1024;

// Runs one AI task. Returns { result } or { error }.
export async function runTask(client, task, input) {
  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    // Re-run on Anthropic's recommended model if a safety classifier declines.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // These are short interpretation tasks, so keep thinking light.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: TASKS[task].schema } },
    system: PROMPTS[task],
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  if (message.stop_reason === 'refusal') return { error: 'refused' };
  if (message.stop_reason === 'max_tokens') return { error: 'incomplete' };
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'bad_output' };
  }
  const result = sanitizeOutput(task, parsed, input);
  // e.g. a "pick" that isn't one of the candidates sent.
  if (!result) return { error: 'bad_output' };
  return { result };
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const headers = { Vary: 'Origin' };
  if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

// Browsers send Origin on cross-site requests. Same-origin requests (the web
// app served by this Worker) and native apps (no Origin) are allowed; other
// sites must be listed in ALLOWED_ORIGINS.
function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  return allowed.includes('*') || allowed.includes(origin);
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export async function handleApi(request, env, { makeClient = (key) => new Anthropic({ apiKey: key }) } = {}) {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!originAllowed(request, env)) return json({ error: 'origin_not_allowed' }, 403, cors);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ ok: true, ai: Boolean(env.ANTHROPIC_API_KEY) }, 200, cors);
  }

  const match = url.pathname.match(/^\/api\/ai\/([a-zA-Z]+)$/);
  if (!match || request.method !== 'POST') return json({ error: 'not_found' }, 404, cors);
  const task = match[1];
  if (!Object.prototype.hasOwnProperty.call(TASKS, task)) return json({ error: 'unknown_task' }, 404, cors);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ai_not_configured' }, 503, cors);

  if (env.AI_LIMITER) {
    const key = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.AI_LIMITER.limit({ key });
    if (!success) return json({ error: 'rate_limited' }, 429, cors);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, cors);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_json' }, 400, cors);
  }
  if (!validateInput(task, input)) return json({ error: 'bad_input' }, 400, cors);

  try {
    const out = await runTask(makeClient(env.ANTHROPIC_API_KEY), task, input);
    if (out.error) return json({ error: out.error }, 422, cors);
    return json({ result: out.result }, 200, cors);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503, cors);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'ai_not_configured' }, 503, cors);
    if (err instanceof Anthropic.APIError) return json({ error: 'ai_error' }, 502, cors);
    return json({ error: 'ai_unreachable' }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
