// Event Master recommendation engine.
//
// Pure functions only: every "apply*" function returns a NEW event object, so
// the same logic powers real events, the Explore demo and the unit tests.

import { getCategory, getSlot, vibeLabel } from '../data/categories';
import { CATALOG, getProduct } from '../data/catalog';
import { round2, uid } from './util';

// ── Colour compatibility ─────────────────────────────────────────────────────
const NEUTRAL_COLOURS = ['white', 'natural'];

export const COLOUR_COMPAT = {
  pink: ['purple', 'gold', 'silver'],
  purple: ['pink', 'silver', 'gold', 'blue'],
  gold: ['black', 'pink', 'purple'],
  silver: ['blue', 'purple', 'black', 'pink'],
  blue: ['silver', 'purple'],
  green: ['gold'],
  rainbow: [],
  black: ['gold', 'silver', 'pink'],
};

export function coloursCompatible(a, b) {
  if (!a || !b || a === b) return true;
  if (NEUTRAL_COLOURS.includes(a) || NEUTRAL_COLOURS.includes(b)) return true;
  return (COLOUR_COMPAT[a] || []).includes(b) || (COLOUR_COMPAT[b] || []).includes(a);
}

// ── Quantities & money ──────────────────────────────────────────────────────
export function computeQty(product, guests) {
  const g = Math.max(1, Math.round(Number(guests) || 1));
  if (product.qty.type === 'fixed') return product.qty.n;
  return Math.max(1, Math.ceil(g / product.qty.per));
}

export function lineTotal(product, guests) {
  return round2(product.price * computeQty(product, guests));
}

export function itemTotal(item) {
  return round2(item.unitPrice * item.qty);
}

export function planTotal(event) {
  return round2(event.items.reduce((sum, i) => sum + itemTotal(i), 0));
}

export function categoryTotal(event, categoryId) {
  return round2(event.items.filter((i) => i.category === categoryId).reduce((s, i) => s + itemTotal(i), 0));
}

export function budgetSummary(event) {
  const total = planTotal(event);
  const budget = typeof event.budget === 'number' && event.budget > 0 ? event.budget : null;
  if (budget == null) return { total, budget: null, remaining: null, ratio: 0, over: false };
  const remaining = round2(budget - total);
  return { total, budget, remaining, ratio: Math.min(1, total / budget), over: remaining < 0 };
}

// ── Slots, categories and completion ────────────────────────────────────────
export function slotKey(categoryId, slotId) {
  return `${categoryId}/${slotId}`;
}

export function slotStatus(event, categoryId, slotId) {
  if (event.items.some((i) => i.category === categoryId && i.slot === slotId)) return 'filled';
  if ((event.skipped || []).includes(slotKey(categoryId, slotId))) return 'skipped';
  return 'open';
}

export function categoryProgress(event, categoryId) {
  const cat = getCategory(categoryId);
  const total = cat.slots.length;
  const resolved = cat.slots.filter((s) => slotStatus(event, categoryId, s.id) !== 'open').length;
  let status = 'not_started';
  if (resolved === total) status = 'complete';
  else if (resolved > 0 || event.declines.some((d) => d.category === categoryId)) status = 'in_progress';
  return { resolved, total, status };
}

export function nextOpenSlot(event, categoryId) {
  const cat = getCategory(categoryId);
  if (!cat) return null;
  return cat.slots.find((s) => slotStatus(event, categoryId, s.id) === 'open') || null;
}

// Prefer the requested category; otherwise the first selected category that
// still has open slots. Returns null when the whole plan is resolved.
export function nextCategoryId(event, preferredId) {
  if (preferredId && event.categories.includes(preferredId) && nextOpenSlot(event, preferredId)) return preferredId;
  return event.categories.find((c) => nextOpenSlot(event, c)) || null;
}

export function isPlanComplete(event) {
  return event.categories.length > 0 && event.categories.every((c) => categoryProgress(event, c).status === 'complete');
}

export function openSlotCount(event) {
  return event.categories.reduce((n, c) => n + getCategory(c).slots.filter((s) => slotStatus(event, c, s.id) === 'open').length, 0);
}

// ── Decline reasons ─────────────────────────────────────────────────────────
export const DECLINE_REASONS = [
  { id: 'expensive', emoji: '💰', label: 'Too expensive' },
  { id: 'colour', emoji: '🎨', label: 'Don’t like the colour' },
  { id: 'style', emoji: '✨', label: 'Don’t like the style' },
  { id: 'size', emoji: '📏', label: 'Wrong size/quantity' },
  { id: 'theme', emoji: '🎪', label: 'Doesn’t fit my theme' },
  { id: 'shop', emoji: '🏪', label: 'Don’t like the shop' },
  { id: 'dislike', emoji: '❌', label: 'I just don’t like this option' },
  { id: 'other', emoji: '✏️', label: 'Something else' },
];

// Simple, predictable keyword matching for "Something else" free text. It only
// maps words it is sure about; anything else is stored as a note and treated
// like "I just don't like this option" (no assumptions).
const NOTE_KEYWORDS = [
  ['expensive', /\b(expensive|pricey|price|cost|costs|cheaper|cheap|budget|afford)\b/i],
  ['colour', /\b(colou?rs?|pink|purple|gold|silver|white|blue|green|rainbow|black)\b/i],
  ['style', /\b(style|look|looks|design|tacky|boring|old[- ]fashioned)\b/i],
  ['size', /\b(size|big|bigger|small|smaller|many|few|quantity|enough|too much)\b/i],
  ['theme', /\b(theme|vibe|match|matches|fit|fits)\b/i],
  ['shop', /\b(shop|store|retailer|seller)\b/i],
];

export function interpretNote(note) {
  if (!note) return [];
  return NOTE_KEYWORDS.filter(([, re]) => re.test(note)).map(([id]) => id);
}

export function vibeOverlap(product, vibes) {
  return product.vibes.filter((v) => (vibes || []).includes(v)).length;
}

function effectiveReasons(decline) {
  return decline.reason === 'other' ? interpretNote(decline.note) : [decline.reason];
}

// Constraints learned from declines within one slot ("find a cheaper one",
// "another colour", ...). Earlier declines keep applying, so the engine never
// swings back to something the user already ruled out.
export function slotConstraints(event, categoryId, slotId) {
  const c = { maxLine: null, avoidColours: [], avoidStyles: [], avoidPacks: [], minVibe: 0 };
  event.declines
    .filter((d) => d.category === categoryId && d.slot === slotId)
    .forEach((d) => {
      effectiveReasons(d).forEach((r) => {
        const s = d.snapshot;
        if (r === 'expensive') c.maxLine = c.maxLine == null ? s.lineTotal : Math.min(c.maxLine, s.lineTotal);
        if (r === 'colour' && !c.avoidColours.includes(s.colour)) c.avoidColours.push(s.colour);
        if (r === 'style' && !c.avoidStyles.includes(s.style)) c.avoidStyles.push(s.style);
        if (r === 'size' && !c.avoidPacks.includes(s.packSize)) c.avoidPacks.push(s.packSize);
        if (r === 'theme') c.minVibe = Math.max(c.minVibe, s.vibeOverlap + 1);
      });
    });
  return c;
}

function hasConstraints(c) {
  return c.maxLine != null || c.avoidColours.length > 0 || c.avoidStyles.length > 0 || c.avoidPacks.length > 0 || c.minVibe > 0;
}

// Shops the user rejected anywhere in this event are avoided for the rest of it.
export function eventAvoidedShops(event) {
  const shops = [];
  event.declines.forEach((d) => {
    if (effectiveReasons(d).includes('shop') && !shops.includes(d.snapshot.retailer)) shops.push(d.snapshot.retailer);
  });
  return shops;
}

// Colour/style dislikes from other slots nudge (but don't block) suggestions.
function eventSoftAvoid(event, categoryId, slotId) {
  const colours = [];
  const styles = [];
  event.declines
    .filter((d) => !(d.category === categoryId && d.slot === slotId))
    .forEach((d) => {
      const rs = effectiveReasons(d);
      if (rs.includes('colour')) colours.push(d.snapshot.colour);
      if (rs.includes('style')) styles.push(d.snapshot.style);
    });
  return { colours, styles };
}

function passes(product, guests, c) {
  if (c.maxLine != null && lineTotal(product, guests) >= c.maxLine) return false;
  if (c.avoidColours.includes(product.colour)) return false;
  if (c.avoidStyles.includes(product.style)) return false;
  if (c.avoidPacks.includes(product.packSize)) return false;
  return true;
}

// ── Scoring ─────────────────────────────────────────────────────────────────
// ctx = { profile: { colours, styles, vibes, shopsLike, shopsAvoid } | null,
//         savedProductIds: string[] }
function scoreProduct(product, event, ctx, cons, relaxed) {
  const qty = computeQty(product, event.guests);
  const lt = lineTotal(product, event.guests);
  const reasons = [];
  let score = 0;

  // Adaptive reasons first: they explain how the last decline was used.
  if (!relaxed) {
    if (cons.maxLine != null) reasons.push('Cheaper than the option you declined');
    if (cons.avoidColours.length) reasons.push('A different colour, as you asked');
    if (cons.avoidStyles.length) reasons.push('A different style, as you asked');
    if (cons.avoidPacks.length) reasons.push('A different size/quantity');
    if (cons.minVibe > 0) reasons.push('Closer to your theme');
  }

  // Theme / vibe match.
  const matched = product.vibes.filter((v) => (event.vibes || []).includes(v));
  score += 3 * matched.length;
  if (matched.length) reasons.push(`Matches your ${matched.slice(0, 2).map(vibeLabel).join(' + ')} vibe`);

  // Compatibility with items already accepted for this event.
  const accepted = event.items.filter((i) => i.colour && !(i.category === product.category && i.slot === product.slot));
  if (accepted.length) {
    const compatible = accepted.filter((i) => coloursCompatible(i.colour, product.colour));
    if (compatible.length / accepted.length >= 0.5) {
      score += 2;
      const partner = [...compatible].reverse().find((i) => !NEUTRAL_COLOURS.includes(i.colour));
      if (partner && !NEUTRAL_COLOURS.includes(product.colour)) reasons.push(`Goes with your ${partner.name}`);
    } else {
      score -= 2;
    }
  }

  // Budget fit: compare against a fair share of what's left.
  const { remaining, budget } = budgetSummary(event);
  if (budget != null) {
    const slotsLeft = Math.max(1, openSlotCount(event));
    const allowance = Math.max(0, remaining) / slotsLeft;
    if (lt <= allowance) {
      score += 2;
      reasons.push('Fits your remaining budget');
    } else if (lt <= remaining) {
      score -= Math.min(3, allowance > 0 ? lt / allowance - 1 : 3);
    } else {
      score -= 8;
    }
  } else {
    score -= lt / 200;
  }

  // Dislikes from elsewhere in this event.
  const soft = eventSoftAvoid(event, product.category, product.slot);
  if (soft.colours.includes(product.colour)) score -= 1.5;
  if (soft.styles.includes(product.style)) score -= 1.5;

  // Long-term memory (only when the user opted to use it for this event).
  const prof = ctx && ctx.profile;
  if (prof) {
    if (prof.colours.includes(product.colour)) {
      score += 1.5;
      reasons.push('In colours you usually love');
    }
    if (prof.styles.includes(product.style)) score += 1;
    score += 0.5 * product.vibes.filter((v) => prof.vibes.includes(v)).length;
    if (prof.shopsLike.includes(product.retailer)) {
      score += 1;
      reasons.push('From a shop you often choose');
    }
    if (prof.shopsAvoid.includes(product.retailer)) score -= 4;
    if (prof.cake && product.subtype === prof.cake) {
      score += 1.5;
      reasons.push(`You usually go for ${prof.cake}`);
    }
  }

  if (ctx && ctx.savedProductIds && ctx.savedProductIds.includes(product.id)) {
    score += 2;
    reasons.push('From your saved ideas');
  }

  if (!reasons.length) {
    const slot = getSlot(product.category, product.slot);
    reasons.push(`One of the best remaining options for your ${slot ? slot.name.toLowerCase() : 'plan'}`);
  }

  return { product, qty, lineTotal: lt, score: round2(score), reasons: reasons.slice(0, 3) };
}

// All remaining candidates for a slot, best first.
export function rankCandidates(event, categoryId, slotId, ctx, opts = {}) {
  const exclude = opts.excludeIds || [];
  const declined = event.declines.map((d) => d.productId);
  const avoidShops = eventAvoidedShops(event);
  const pool = CATALOG.filter(
    (p) =>
      p.category === categoryId &&
      p.slot === slotId &&
      !declined.includes(p.id) &&
      !exclude.includes(p.id) &&
      !avoidShops.includes(p.retailer),
  );
  const cons = slotConstraints(event, categoryId, slotId);
  let list = pool.filter((p) => passes(p, event.guests, cons));
  let relaxed = false;
  if (!list.length && pool.length) {
    list = pool;
    relaxed = hasConstraints(cons);
  }
  const ranked = list
    .map((p) => scoreProduct(p, event, ctx, cons, relaxed))
    .sort((a, b) => b.score - a.score || a.lineTotal - b.lineTotal || (a.product.id < b.product.id ? -1 : 1));
  return { list: ranked, relaxed };
}

export function suggestNext(event, categoryId, slotId, ctx, opts) {
  const { list, relaxed } = rankCandidates(event, categoryId, slotId, ctx, opts);
  return { suggestion: list[0] || null, relaxed, remaining: list.length };
}

// ── Plan mutations (immutable) ──────────────────────────────────────────────
function itemFromSuggestion(s, categoryId, slotId) {
  const p = s.product;
  return {
    id: uid('item'),
    productId: p.id,
    custom: false,
    category: categoryId,
    slot: slotId,
    name: p.name,
    emoji: p.emoji,
    colour: p.colour,
    style: p.style,
    retailer: p.retailer,
    url: p.url,
    packLabel: p.packLabel,
    unitPrice: p.price,
    qty: s.qty,
    notes: '',
  };
}

function unskip(event, categoryId, slotId) {
  const key = slotKey(categoryId, slotId);
  return (event.skipped || []).filter((k) => k !== key);
}

export function applyAccept(event, suggestion) {
  const p = suggestion.product;
  return {
    ...event,
    items: [...event.items, itemFromSuggestion(suggestion, p.category, p.slot)],
    skipped: unskip(event, p.category, p.slot),
  };
}

export function applyDecline(event, suggestion, reason, note = '') {
  const p = suggestion.product;
  const decline = {
    id: uid('dec'),
    productId: p.id,
    category: p.category,
    slot: p.slot,
    reason,
    note: note.trim(),
    snapshot: {
      name: p.name,
      lineTotal: suggestion.lineTotal,
      colour: p.colour,
      style: p.style,
      packSize: p.packSize,
      retailer: p.retailer,
      vibeOverlap: vibeOverlap(p, event.vibes),
    },
  };
  return { ...event, declines: [...event.declines, decline] };
}

export function applySkip(event, categoryId, slotId) {
  const key = slotKey(categoryId, slotId);
  if ((event.skipped || []).includes(key)) return event;
  return { ...event, skipped: [...(event.skipped || []), key] };
}

// A user-supplied item ("I already have one"). Optionally replaces an item.
export function applyOwnItem(event, { categoryId, slotId, name, price, qty, url, notes }, replaceItemId) {
  const item = {
    id: uid('item'),
    productId: null,
    custom: true,
    category: categoryId,
    slot: slotId,
    name: name.trim(),
    emoji: getCategory(categoryId).emoji,
    colour: null,
    style: null,
    retailer: null,
    url: url ? url.trim() : null,
    packLabel: null,
    unitPrice: round2(Number(price) || 0),
    qty: Math.max(1, Math.round(Number(qty) || 1)),
    notes: notes ? notes.trim() : '',
  };
  const items = replaceItemId ? event.items.map((i) => (i.id === replaceItemId ? item : i)) : [...event.items, item];
  return { ...event, items, skipped: unskip(event, categoryId, slotId) };
}

// CHANGE ≠ DECLINE: replacing an accepted item records no decline, so nothing
// negative is learned about the original.
export function applyReplace(event, itemId, suggestion) {
  const old = event.items.find((i) => i.id === itemId);
  if (!old) return event;
  const next = itemFromSuggestion(suggestion, old.category, old.slot);
  return { ...event, items: event.items.map((i) => (i.id === itemId ? next : i)) };
}

export const REMOVE_REASONS = [
  { id: 'better', label: 'Found something better' },
  { id: 'expensive', label: 'Too expensive' },
  { id: 'not_needed', label: 'No longer needed' },
  { id: 'changed_mind', label: 'Changed my mind' },
  { id: 'other', label: 'Other' },
];

// A one-off removal is never turned into memory. "No longer needed" marks the
// slot as resolved so the category can still complete.
export function applyRemove(event, itemId, reason) {
  const old = event.items.find((i) => i.id === itemId);
  if (!old) return event;
  const next = { ...event, items: event.items.filter((i) => i.id !== itemId) };
  return reason === 'not_needed' ? applySkip(next, old.category, old.slot) : next;
}

export function applyQty(event, itemId, qty) {
  const q = Math.max(1, Math.round(Number(qty) || 1));
  return { ...event, items: event.items.map((i) => (i.id === itemId ? { ...i, qty: q } : i)) };
}

// ── Interconnected plan: what an edit affects ───────────────────────────────
export function analyseChanges(before, after) {
  const changes = { guests: null, budget: null, vibes: null, removedCategories: [] };

  if (before.guests !== after.guests) {
    const items = after.items
      .filter((i) => i.productId)
      .map((i) => {
        const p = getProduct(i.productId);
        if (!p || p.qty.type !== 'perGuest') return null;
        const suggested = computeQty(p, after.guests);
        return suggested !== i.qty ? { itemId: i.id, name: i.name, from: i.qty, to: suggested } : null;
      })
      .filter(Boolean);
    changes.guests = { from: before.guests, to: after.guests, items };
  }

  const { budget, over, remaining } = budgetSummary(after);
  if (before.budget !== after.budget && budget != null && over) {
    changes.budget = { from: before.budget, to: after.budget, overBy: -remaining };
  }

  const vibesChanged = [...before.vibes].sort().join() !== [...after.vibes].sort().join();
  if (vibesChanged && after.vibes.length) {
    const items = after.items
      .filter((i) => i.productId)
      .filter((i) => {
        const p = getProduct(i.productId);
        return p && vibeOverlap(p, after.vibes) === 0;
      })
      .map((i) => ({ itemId: i.id, name: i.name }));
    if (items.length) changes.vibes = { items };
  }

  changes.removedCategories = before.categories.filter((c) => !after.categories.includes(c));
  return changes;
}

export function changesNeedReview(ch) {
  return !!((ch.guests && ch.guests.items.length) || ch.budget || ch.vibes);
}

// Apply an edit to the event's details. Items/skips for categories the user
// deselected are dropped from the plan.
export function applyEdit(event, patch) {
  const next = { ...event, ...patch };
  const cats = next.categories;
  next.items = next.items.filter((i) => cats.includes(i.category));
  next.skipped = (next.skipped || []).filter((k) => cats.includes(k.split('/')[0]));
  return next;
}
