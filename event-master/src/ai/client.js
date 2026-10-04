import { Platform } from 'react-native';

import { sanitizeOutput } from './contract';

// Where the Event Master Worker lives.
// - Native apps (and web during development): set EXPO_PUBLIC_API_URL, e.g.
//   https://event-master.<you>.workers.dev
// - Web served by the Worker itself: leave it unset; the app uses its own origin.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const BASE = ENV_URL ? ENV_URL.replace(/\/+$/, '') : Platform.OS === 'web' ? '' : null;

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let health = null;

// Resolves to true when the server is reachable and has AI configured.
export function checkAI() {
  if (BASE === null) return Promise.resolve(false);
  if (!health) {
    health = fetchWithTimeout(`${BASE}/api/health`, {}, 6000)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => Boolean(j && j.ai))
      .catch(() => false);
  }
  return health;
}

// Runs an AI task. Returns the sanitised result, or null if AI is unavailable
// or anything goes wrong — callers always have a non-AI fallback.
export async function askAI(task, input) {
  if (!(await checkAI())) return null;
  try {
    const res = await fetchWithTimeout(
      `${BASE}/api/ai/${task}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
      30000,
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body && body.result ? sanitizeOutput(task, body.result) : null;
  } catch {
    return null;
  }
}

// ── Input builders: only what the AI needs (no event names or venues) ──────
export function eventInfo(event) {
  return {
    type: event.type || null,
    typeOther: event.typeOther || '',
    otherVibe: event.otherVibe || '',
    vibes: (event.vibes || []).filter((v) => v !== 'other'),
    guests: event.guests,
    budget: event.budget ?? null,
    categories: event.categories || [],
  };
}

export function productFacts(suggestion) {
  const p = suggestion.product;
  return { name: p.name, colour: p.colour, style: p.style, retailer: p.retailer, lineTotal: suggestion.lineTotal };
}

// Text describing an event in the user's own words, if any.
export function ownWordsText(event) {
  const parts = [];
  if (event.type === 'other' && event.typeOther) parts.push(`Event: ${event.typeOther}`);
  if ((event.vibes || []).includes('other') && event.otherVibe) parts.push(`Vibe: ${event.otherVibe}`);
  return parts.join('. ');
}
