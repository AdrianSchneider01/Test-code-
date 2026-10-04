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
export async function askAI(task, input, timeoutMs = 30000) {
  if (!(await checkAI())) return null;
  try {
    const res = await fetchWithTimeout(
      `${BASE}/api/ai/${task}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
      timeoutMs,
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body && body.result ? sanitizeOutput(task, body.result, input) : null;
  } catch {
    return null;
  }
}

export { eventInfo, ownWordsText, productFacts } from './inputs';
