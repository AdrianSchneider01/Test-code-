import { Platform } from 'react-native';

import { TASKS, sanitizeOutput, validateInput } from './contract';
import { buildPrompt } from './prompts';

// Two ways to reach Claude:
// 1. Inside claude.ai (the app published as an Artifact): the page's own
//    "sample" capability, which uses the viewer's Claude account. No server
//    or API key; the viewer is asked to allow it on first use.
// 2. Anywhere else: the Event Master Worker (see worker/), which holds the
//    Anthropic API key.
//    - Native apps (and web during development): set EXPO_PUBLIC_API_URL,
//      e.g. https://event-master.<you>.workers.dev
//    - Web served by the Worker itself: leave it unset; the app uses its own origin.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const BASE = ENV_URL ? ENV_URL.replace(/\/+$/, '') : Platform.OS === 'web' ? '' : null;

// Quick tasks need a fast answer; ideas can take a little longer for better results.
const SAMPLE_TIER = { ideas: 'default' };
// Errors that mean Claude can't be used in this view at all.
const SAMPLE_OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'];

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let backend = null;
const listeners = new Set();

// Lets the app hear when AI becomes unavailable (e.g. the viewer declined).
export function onAIUnavailable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Resolves to { kind: 'sample', sample } | { kind: 'worker' } | null.
function getBackend() {
  if (!backend) {
    backend = (async () => {
      const host = typeof window !== 'undefined' ? window.claude : undefined;
      if (host && typeof host.use === 'function') {
        try {
          const sample = await host.use('sample');
          if (sample) return { kind: 'sample', sample };
        } catch {
          // fall through to the Worker
        }
      }
      if (BASE === null) return null;
      try {
        const r = await fetchWithTimeout(`${BASE}/api/health`, {}, 6000);
        const j = r.ok ? await r.json() : null;
        return j && j.ai ? { kind: 'worker' } : null;
      } catch {
        return null;
      }
    })();
  }
  return backend;
}

// Resolves to true when some way of reaching Claude is available.
export async function checkAI() {
  return Boolean(await getBackend());
}

async function askSample(sample, task, input) {
  if (!validateInput(task, input)) return null;
  try {
    const raw = await sample.json(buildPrompt(task, input, TASKS[task].schema), { modelTier: SAMPLE_TIER[task] || 'quick' });
    return sanitizeOutput(task, raw, input);
  } catch (e) {
    // Claude isn't usable in this view (e.g. the viewer said no): stop asking.
    if (e && SAMPLE_OFF.includes(e.code)) {
      backend = Promise.resolve(null);
      listeners.forEach((fn) => fn());
    }
    return null;
  }
}

// Runs an AI task. Returns the sanitised result, or null if AI is unavailable
// or anything goes wrong — callers always have a non-AI fallback.
export async function askAI(task, input, timeoutMs = 30000) {
  const b = await getBackend();
  if (!b) return null;
  // The sample capability manages its own time limits (and the viewer's
  // consent dialog), so no page-side timeout there.
  if (b.kind === 'sample') return askSample(b.sample, task, input);
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
