// AI contract shared by the app and the Cloudflare Worker.
//
// Each AI task has a JSON schema (sent to Claude as a structured-output
// format) and a sanitiser. Everything the AI returns is filtered down to
// Event Master's own vocabulary (colours, styles, vibes, shops, categories),
// so AI output can steer suggestions but can never invent products, prices
// or links. The app runs the sanitiser again on whatever the server returns.

import { CATEGORY_IDS, COLOURS, EVENT_TYPES, STYLES, VIBES } from '../data/categories';
import { SHOPS } from '../data/catalog';

export const VIBE_IDS = VIBES.filter((v) => v.id !== 'other').map((v) => v.id);
export const AI_REASON_IDS = ['expensive', 'colour', 'style', 'size', 'theme', 'shop'];
export const AI_MEMORY_TYPES = ['colour', 'style', 'vibe', 'shopLike', 'shopAvoid', 'budget', 'eventType', 'cake', 'note'];
const EVENT_TYPE_IDS = EVENT_TYPES.filter((t) => t.id !== 'other').map((t) => t.id);

// ── Schema helpers ──────────────────────────────────────────────────────────
const str = { type: 'string' };
const enumList = (values) => ({ type: 'array', items: { type: 'string', enum: values } });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const TASKS = {
  // "Something else" decline text → structured feedback about the rejected product.
  feedback: {
    schema: obj({
      reasons: enumList(AI_REASON_IDS),
      avoidColours: enumList(COLOURS),
      preferColours: enumList(COLOURS),
      preferStyles: enumList(STYLES),
      preferVibes: enumList(VIBE_IDS),
      summary: str,
    }),
  },
  // "Ask Event Master" requests such as "something more elegant".
  refine: {
    schema: obj({
      preferVibes: enumList(VIBE_IDS),
      preferColours: enumList(COLOURS),
      avoidColours: enumList(COLOURS),
      preferStyles: enumList(STYLES),
      avoidStyles: enumList(STYLES),
      maxPrice: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      summary: str,
    }),
  },
  // Free-text vibe / "Something else" event descriptions → known vibes, colours, styles.
  vibe: {
    schema: obj({ vibes: enumList(VIBE_IDS), colours: enumList(COLOURS), styles: enumList(STYLES), summary: str }),
  },
  // "Tell me about your style" → candidate memories for the user to confirm.
  memories: {
    schema: obj({
      memories: { type: 'array', items: obj({ type: { type: 'string', enum: AI_MEMORY_TYPES }, value: str }) },
    }),
  },
  // A short, friendly summary of the user's memory profile.
  profileSummary: { schema: obj({ summary: str }) },
  // Choose the best-fitting product from candidates the app has already
  // filtered, using everything known about the party and the user.
  pick: { schema: obj({ choiceId: str, reason: str }) },
  // A friendlier explanation of why a product was suggested (facts supplied by the app).
  explain: { schema: obj({ explanation: str }) },
  // Party ideas (themes, activities, touches) — ideas only, never products.
  ideas: {
    schema: obj({
      ideas: { type: 'array', items: obj({ emoji: str, title: str, text: str, category: { type: 'string', enum: CATEGORY_IDS } }) },
    }),
  },
};

export const TASK_IDS = Object.keys(TASKS);

// ── Sanitising ──────────────────────────────────────────────────────────────
function pick(list, allowed, max = 6) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach((v) => {
    const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
    const match = allowed.find((a) => a.toLowerCase() === s);
    if (match && !out.includes(match) && out.length < max) out.push(match);
  });
  return out;
}

function text(v, max = 240) {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function memoryValue(type, value) {
  switch (type) {
    case 'colour':
      return pick([value], COLOURS)[0] || null;
    case 'style':
      return pick([value], STYLES)[0] || null;
    case 'vibe':
      return pick([value], VIBE_IDS)[0] || null;
    case 'shopLike':
    case 'shopAvoid':
      return pick([value], SHOPS)[0] || null;
    case 'eventType':
      return pick([value], EVENT_TYPE_IDS)[0] || null;
    case 'cake':
      return pick([value], ['cake', 'cupcakes'])[0] || null;
    case 'budget':
    case 'note':
      return text(value, 120) || null;
    default:
      return null;
  }
}

// `input` (optional) lets tasks check the answer against what was asked —
// e.g. a pick must be one of the candidates that were sent.
export function sanitizeOutput(task, raw, input) {
  const r = raw && typeof raw === 'object' ? raw : {};
  switch (task) {
    case 'feedback':
      return {
        reasons: pick(r.reasons, AI_REASON_IDS),
        avoidColours: pick(r.avoidColours, COLOURS),
        preferColours: pick(r.preferColours, COLOURS),
        preferStyles: pick(r.preferStyles, STYLES),
        preferVibes: pick(r.preferVibes, VIBE_IDS),
        summary: text(r.summary, 120),
      };
    case 'refine': {
      const price = Number(r.maxPrice);
      return {
        preferVibes: pick(r.preferVibes, VIBE_IDS),
        preferColours: pick(r.preferColours, COLOURS),
        avoidColours: pick(r.avoidColours, COLOURS),
        preferStyles: pick(r.preferStyles, STYLES),
        avoidStyles: pick(r.avoidStyles, STYLES),
        maxPrice: r.maxPrice != null && Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null,
        summary: text(r.summary, 120),
      };
    }
    case 'vibe':
      return { vibes: pick(r.vibes, VIBE_IDS), colours: pick(r.colours, COLOURS), styles: pick(r.styles, STYLES), summary: text(r.summary, 120) };
    case 'memories': {
      const seen = [];
      const memories = (Array.isArray(r.memories) ? r.memories : [])
        .map((m) => {
          const type = m && AI_MEMORY_TYPES.includes(m.type) ? m.type : null;
          const value = type ? memoryValue(type, m.value) : null;
          return type && value ? { type, value } : null;
        })
        .filter((m) => {
          if (!m) return false;
          const key = `${m.type}:${m.value}`;
          if (seen.includes(key)) return false;
          seen.push(key);
          return true;
        });
      return { memories: memories.slice(0, 12) };
    }
    case 'pick': {
      const ids = input && Array.isArray(input.candidates) ? input.candidates.map((c) => c.id) : null;
      const choiceId = typeof r.choiceId === 'string' ? r.choiceId.trim() : '';
      if (!choiceId || (ids && !ids.includes(choiceId))) return null;
      return { choiceId, reason: text(r.reason, 160) };
    }
    case 'profileSummary':
      return { summary: text(r.summary, 400) };
    case 'explain':
      return { explanation: text(r.explanation, 400) };
    case 'ideas':
      return {
        ideas: (Array.isArray(r.ideas) ? r.ideas : [])
          .map((i) => ({
            emoji: text(i && i.emoji, 8) || '✨',
            title: text(i && i.title, 60),
            text: text(i && i.text, 200),
            category: pick([i && i.category], CATEGORY_IDS)[0] || 'extras',
          }))
          .filter((i) => i.title && i.text)
          .slice(0, 6),
      };
    default:
      return null;
  }
}

// ── Input validation (server side; the app builds inputs that pass) ────────
const MAX_TEXT = 600;
const isText = (v, max = MAX_TEXT) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isOptText = (v, max = MAX_TEXT) => v == null || (typeof v === 'string' && v.length <= max);
const isStrList = (v, maxItems = 20) => Array.isArray(v) && v.length <= maxItems && v.every((s) => isText(s, 200));
const isOptNum = (v) => v == null || (typeof v === 'number' && Number.isFinite(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function isProduct(p) {
  return isObj(p) && isText(p.name, 120) && isOptText(p.colour, 40) && isOptText(p.style, 40) && isOptText(p.retailer, 60) && isOptNum(p.lineTotal);
}

function isEventInfo(e) {
  return (
    isObj(e) &&
    isOptText(e.type, 40) &&
    isOptText(e.typeOther, 120) &&
    isOptText(e.otherVibe, 120) &&
    (e.vibes == null || isStrList(e.vibes, 12)) &&
    (e.categories == null || isStrList(e.categories, 12)) &&
    isOptNum(e.guests) &&
    isOptNum(e.budget)
  );
}

const isOptStrList = (v, maxItems) => v == null || (Array.isArray(v) && v.length <= maxItems && v.every((s) => typeof s === 'string' && s.length <= 300));

function isCandidate(c) {
  return (
    isObj(c) &&
    isText(c.id, 60) &&
    isText(c.name, 120) &&
    isOptText(c.colour, 40) &&
    isOptText(c.style, 40) &&
    isOptText(c.retailer, 60) &&
    isOptText(c.packLabel, 60) &&
    isOptNum(c.lineTotal) &&
    isOptStrList(c.vibes, 10) &&
    isOptStrList(c.whyRules, 6)
  );
}

function isPickContext(c) {
  return (
    isObj(c) &&
    isOptText(c.lookingFor, 120) &&
    isOptStrList(c.accepted, 30) &&
    isOptStrList(c.declined, 30) &&
    isOptStrList(c.requests, 15) &&
    isOptText(c.vibeUnderstanding, 200) &&
    isOptStrList(c.profile, 30) &&
    isOptStrList(c.savedIdeas, 15) &&
    isOptStrList(c.partyIdeas, 10) &&
    isOptNum(c.remainingBudget)
  );
}

export function validateInput(task, input) {
  if (!isObj(input)) return false;
  switch (task) {
    case 'feedback':
      return isText(input.note) && isProduct(input.product);
    case 'refine':
      return isText(input.text) && isEventInfo(input.event) && (input.product == null || isProduct(input.product));
    case 'vibe':
    case 'memories':
      return isText(input.text, 1200);
    case 'profileSummary':
      return isStrList(input.memories, 40) && input.memories.length > 0;
    case 'pick':
      return (
        isEventInfo(input.event) &&
        isPickContext(input.context) &&
        Array.isArray(input.candidates) &&
        input.candidates.length >= 2 &&
        input.candidates.length <= 8 &&
        input.candidates.every(isCandidate)
      );
    case 'explain':
      return isProduct(input.product) && isStrList(input.reasons, 6) && isEventInfo(input.event);
    case 'ideas':
      return isEventInfo(input.event);
    default:
      return false;
  }
}
