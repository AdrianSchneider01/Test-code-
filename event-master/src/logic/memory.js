// Long-term memory.
//
// Memories are PATTERNS: something becomes a learned memory only when it shows
// up in at least PATTERN_THRESHOLD saved events. One choice never becomes a
// permanent preference. The user stays in control: manual memories override
// learned ones, any memory can be forgotten, and memory can be cleared or
// switched off entirely.

import { COLOURS, EVENT_TYPES, STYLES, VIBES, capitalise, vibeLabel } from '../data/categories';
import { SHOPS, getProduct } from '../data/catalog';
import { DECLINE_REASONS, eventAvoidedShops } from './engine';
import { money, uid } from './util';

export const PATTERN_THRESHOLD = 2;

const NEUTRAL = ['white', 'natural'];

export const MEMORY_TYPES = [
  { id: 'colour', section: 'style', label: 'Favourite colours', options: COLOURS },
  { id: 'style', section: 'style', label: 'Favourite styles', options: STYLES },
  { id: 'vibe', section: 'style', label: 'Favourite themes & vibes', options: VIBES.filter((v) => v.id !== 'other').map((v) => v.id) },
  { id: 'shopLike', section: 'shopping', label: 'Shops often chosen', options: SHOPS },
  { id: 'shopAvoid', section: 'shopping', label: 'Shops not wanted', options: SHOPS },
  { id: 'budget', section: 'planning', label: 'Typical budget range', options: null, single: true },
  { id: 'eventType', section: 'planning', label: 'Common event types', options: EVENT_TYPES.filter((t) => t.id !== 'other').map((t) => t.id) },
  { id: 'cake', section: 'planning', label: 'Cake or cupcakes', options: ['cake', 'cupcakes'], single: true },
  { id: 'note', section: 'planning', label: 'Other planning patterns', options: null },
];

export const MEMORY_SECTIONS = [
  { id: 'style', emoji: '✨', title: 'Your Style' },
  { id: 'shopping', emoji: '🛍️', title: 'Shopping preferences' },
  { id: 'planning', emoji: '💰', title: 'Planning preferences' },
];

export function memoryType(id) {
  return MEMORY_TYPES.find((t) => t.id === id);
}

export function optionLabel(typeId, value) {
  if (typeId === 'vibe') return vibeLabel(value);
  if (typeId === 'eventType') {
    const t = EVENT_TYPES.find((x) => x.id === value);
    return t ? t.label : value;
  }
  if (typeId === 'colour' || typeId === 'style' || typeId === 'cake') return capitalise(value);
  return value;
}

export const DEFAULT_MEMORY = { enabled: true, manual: [], forgotten: [], clearedAt: null };

// What a single event tells us (used for patterns and "What I learned").
export function observationsFromEvent(event) {
  const products = event.items.filter((i) => i.productId).map((i) => getProduct(i.productId)).filter(Boolean);
  const uniq = (arr) => arr.filter((v, i) => v && arr.indexOf(v) === i);
  const cakeItem = event.items.find((i) => i.category === 'cake' && i.slot === 'cake' && i.productId);
  const cakeProduct = cakeItem ? getProduct(cakeItem.productId) : null;
  return {
    colour: uniq(products.map((p) => p.colour).filter((c) => !NEUTRAL.includes(c))),
    style: uniq(products.map((p) => p.style)),
    vibe: uniq((event.vibes || []).filter((v) => v !== 'other')),
    shopLike: uniq(products.map((p) => p.retailer)),
    shopAvoid: eventAvoidedShops(event),
    eventType: event.type && event.type !== 'other' ? [event.type] : [],
    cake: cakeProduct && cakeProduct.subtype ? [cakeProduct.subtype] : [],
  };
}

function eligibleEvents(events, memory) {
  return events.filter((e) => e.status === 'saved' && e.savedAt && (!memory.clearedAt || e.savedAt > memory.clearedAt));
}

export function describeLearned(type, value, count) {
  const label = optionLabel(type, value);
  switch (type) {
    case 'colour':
      return `You’ve chosen ${value} for ${count} events`;
    case 'style':
      return `You’ve picked ${value} styles for ${count} events`;
    case 'vibe':
      return `You’ve gone ${label} for ${count} events`;
    case 'shopLike':
      return `You’ve chosen ${value} for ${count} events`;
    case 'shopAvoid':
      return `You’ve avoided ${value} in ${count} events`;
    case 'eventType':
      return `You’ve planned ${count} ${label.toLowerCase()} events`;
    case 'cake':
      return `You went with ${value} for ${count} events`;
    case 'budget':
      return `Your budgets usually range ${value}`;
    default:
      return label;
  }
}

export function learnedMemories(events, memory) {
  const eligible = eligibleEvents(events, memory);
  const counts = {};
  eligible.forEach((e) => {
    const obs = observationsFromEvent(e);
    Object.keys(obs).forEach((type) => {
      obs[type].forEach((value) => {
        const key = `${type}:${value}`;
        counts[key] = counts[key] || { key, type, value, count: 0 };
        counts[key].count += 1;
      });
    });
  });
  const out = Object.values(counts).filter((m) => m.count >= PATTERN_THRESHOLD);

  const budgets = eligible.map((e) => e.budget).filter((b) => typeof b === 'number' && b > 0);
  if (budgets.length >= PATTERN_THRESHOLD) {
    const lo = Math.min(...budgets);
    const hi = Math.max(...budgets);
    const value = lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
    out.push({ key: 'budget:learned', type: 'budget', value, count: budgets.length });
  }

  return out
    .filter((m) => !memory.forgotten.includes(m.key))
    .map((m) => ({ ...m, source: 'learned', text: describeLearned(m.type, m.value, m.count) }))
    .sort((a, b) => b.count - a.count);
}

// Manual memories first; for single-value types a manual entry replaces the
// learned one, and duplicates of a manual memory are hidden.
export function effectiveMemories(events, memory) {
  const manual = memory.manual.map((m) => ({
    ...m,
    key: `manual:${m.id}`,
    source: 'manual',
    text: `${memoryType(m.type).label}: ${optionLabel(m.type, m.value)}`,
  }));
  const learned = learnedMemories(events, memory).filter((l) => {
    const t = memoryType(l.type);
    if (t && t.single && manual.some((m) => m.type === l.type)) return false;
    return !manual.some((m) => m.type === l.type && m.value === l.value);
  });
  return [...manual, ...learned];
}

export function profileFromMemories(list) {
  const pick = (type) => list.filter((m) => m.type === type).map((m) => m.value);
  const cake = pick('cake');
  return {
    colours: pick('colour'),
    styles: pick('style'),
    vibes: pick('vibe'),
    shopsLike: pick('shopLike'),
    shopsAvoid: pick('shopAvoid'),
    cake: cake.length ? cake[0] : null,
  };
}

// Memory operations (immutable).
export function addManualMemory(memory, type, value) {
  const v = String(value).trim();
  if (!v) return memory;
  if (memory.manual.some((m) => m.type === type && m.value === v)) return memory;
  const t = memoryType(type);
  const manual = t && t.single ? memory.manual.filter((m) => m.type !== type) : memory.manual;
  return { ...memory, manual: [...manual, { id: uid('mem'), type, value: v }] };
}

export function forgetMemory(memory, mem) {
  if (mem.source === 'manual') return { ...memory, manual: memory.manual.filter((m) => `manual:${m.id}` !== mem.key) };
  return memory.forgotten.includes(mem.key) ? memory : { ...memory, forgotten: [...memory.forgotten, mem.key] };
}

// CHANGE: the user's edit becomes a manual memory and the old one is forgotten.
export function changeMemory(memory, mem, newValue) {
  return addManualMemory(forgetMemory(memory, mem), mem.type, newValue);
}

export function clearAllMemory(memory, nowISO) {
  return { ...memory, manual: [], forgotten: [], clearedAt: nowISO };
}

// "What I learned from this event"
export function eventLearnings(event) {
  const obs = observationsFromEvent(event);
  const lines = [];
  if (obs.colour.length) lines.push(`🎨 Colours you chose: ${obs.colour.join(', ')}`);
  if (obs.style.length) lines.push(`✨ Styles you accepted: ${obs.style.join(', ')}`);
  if (obs.vibe.length) lines.push(`🎉 Vibe: ${obs.vibe.map(vibeLabel).join(', ')}`);
  if (obs.shopLike.length) lines.push(`🛍️ Shops you chose: ${obs.shopLike.join(', ')}`);
  if (obs.shopAvoid.length) lines.push(`🚫 Shops you avoided: ${obs.shopAvoid.join(', ')}`);
  if (obs.cake.length) lines.push(`🎂 You went with ${obs.cake[0]}`);
  const byReason = {};
  event.declines.forEach((d) => {
    byReason[d.reason] = (byReason[d.reason] || 0) + 1;
  });
  Object.keys(byReason).forEach((r) => {
    const reason = DECLINE_REASONS.find((x) => x.id === r);
    if (reason) lines.push(`${reason.emoji} Declined ${byReason[r]}× — “${reason.label}”`);
  });
  return lines;
}
