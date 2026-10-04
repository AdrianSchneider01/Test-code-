import { DEFAULT_CATEGORY_IDS } from '../data/categories';
import { getProduct } from '../data/catalog';
import { applyAccept, computeQty, isPlanComplete } from './engine';
import { todayISO, uid } from './util';

export function newDraft({ vibes = [], useMemory = false } = {}) {
  return {
    type: null,
    typeOther: '',
    name: '',
    date: null,
    venue: { mode: null, name: '' },
    guests: 12,
    budgetText: '',
    budgetUnsure: false,
    vibes,
    otherVibe: '',
    categories: [...DEFAULT_CATEGORY_IDS],
    useMemory,
  };
}

export function parseBudget(text) {
  const n = Number(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function createEventFromDraft(draft, nowISO = new Date().toISOString()) {
  return {
    id: uid('evt'),
    name: draft.name.trim(),
    type: draft.type,
    typeOther: draft.typeOther.trim(),
    date: draft.date,
    venue: { mode: draft.venue.mode, name: draft.venue.name.trim() },
    guests: draft.guests,
    budget: draft.budgetUnsure ? null : parseBudget(draft.budgetText),
    vibes: draft.vibes,
    otherVibe: draft.otherVibe.trim(),
    categories: draft.categories,
    items: [],
    declines: [],
    skipped: [],
    useMemory: !!draft.useMemory,
    status: 'planning',
    createdAt: nowISO,
    savedAt: null,
  };
}

export function eventStatusLabel(event, today = todayISO()) {
  if (event.status === 'saved') return event.date && event.date < today ? 'Completed' : 'Upcoming';
  return isPlanComplete(event) ? 'Ready to save' : 'In progress';
}

// Build an event from a list of product ids (used by the example party).
export function eventWithProducts(base, productIds) {
  return productIds.reduce((ev, id) => {
    const product = getProduct(id);
    return applyAccept(ev, { product, qty: computeQty(product, ev.guests) });
  }, base);
}

export const EXAMPLE_PARTY = eventWithProducts(
  {
    id: 'example_sofia',
    name: 'Sofia’s 11th Birthday',
    type: 'birthday',
    typeOther: '',
    date: '2026-11-14',
    venue: { mode: 'own', name: 'Home — backyard' },
    guests: 12,
    budget: 300,
    vibes: ['cute', 'party'],
    otherVibe: '',
    categories: ['decorations', 'food', 'cake', 'activities', 'invitations', 'favours'],
    items: [],
    declines: [],
    skipped: [],
    useMemory: false,
    status: 'saved',
    createdAt: '2026-10-01T00:00:00.000Z',
    savedAt: '2026-10-01T00:00:00.000Z',
  },
  [
    'bal-pink-20', 'ban-purple-stars', 'tab-pink-set', 'bd-foil-purple',
    'food-pizza', 'snk-fruit-cups', 'drk-lemonade',
    'cake-pink-tier', 'cnd-pink-sparkler',
    'act-bracelet-bar', 'gm-pinata',
    'inv-printed-pink',
    'bag-pink-paper', 'fil-lipgloss',
  ],
);
