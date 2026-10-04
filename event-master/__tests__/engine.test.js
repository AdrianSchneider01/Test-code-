import { getProduct, CATALOG } from '../src/data/catalog';
import { CATEGORIES } from '../src/data/categories';
import {
  analyseChanges,
  applyAccept,
  applyDecline,
  applyEdit,
  applyOwnItem,
  applyRemove,
  applyReplace,
  applySkip,
  budgetSummary,
  categoryProgress,
  changesNeedReview,
  computeQty,
  coloursCompatible,
  interpretNote,
  isPlanComplete,
  nextCategoryId,
  nextOpenSlot,
  rankCandidates,
  suggestNext,
} from '../src/logic/engine';
import { EXAMPLE_PARTY, createEventFromDraft, newDraft } from '../src/logic/events';

function makeEvent(overrides = {}) {
  return {
    id: 'e1',
    name: 'Test',
    type: 'birthday',
    date: '2026-12-01',
    venue: { mode: 'own', name: 'Home' },
    guests: 10,
    budget: 150,
    vibes: ['cute', 'fun'],
    categories: ['decorations'],
    items: [],
    declines: [],
    skipped: [],
    status: 'planning',
    ...overrides,
  };
}

const ctx = { profile: null, savedProductIds: [] };

describe('catalogue integrity', () => {
  test('every product belongs to a real category slot and has the fields the UI needs', () => {
    const ids = new Set();
    CATALOG.forEach((p) => {
      const cat = CATEGORIES.find((c) => c.id === p.category);
      expect(cat).toBeTruthy();
      expect(cat.slots.some((s) => s.id === p.slot)).toBe(true);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(typeof p.price).toBe('number');
      expect(p.url).toBeNull();
    });
  });

  test('every slot has at least three options', () => {
    CATEGORIES.forEach((c) =>
      c.slots.forEach((s) => {
        expect(CATALOG.filter((p) => p.category === c.id && p.slot === s.id).length).toBeGreaterThanOrEqual(3);
      }),
    );
  });
});

describe('quantities and budget', () => {
  test('per-guest quantities round up; fixed stay fixed', () => {
    expect(computeQty(getProduct('bal-pink-20'), 12)).toBe(2);
    expect(computeQty(getProduct('bal-pink-20'), 10)).toBe(1);
    expect(computeQty(getProduct('gm-pinata'), 40)).toBe(1);
    expect(computeQty(getProduct('snk-fruit-cups'), 7)).toBe(7);
  });

  test('accepting updates total and remaining budget', () => {
    let ev = makeEvent({ guests: 12 });
    const { suggestion } = suggestNext(ev, 'decorations', 'balloons', ctx);
    ev = applyAccept(ev, suggestion);
    const b = budgetSummary(ev);
    expect(b.total).toBe(suggestion.lineTotal);
    expect(b.remaining).toBe(150 - suggestion.lineTotal);
  });

  test('no budget → remaining is null', () => {
    expect(budgetSummary(makeEvent({ budget: null })).remaining).toBeNull();
  });
});

describe('suggestions', () => {
  test('cute/fun event gets the pink balloon set first, with reasons', () => {
    const { suggestion } = suggestNext(makeEvent(), 'decorations', 'balloons', ctx);
    expect(suggestion.product.id).toBe('bal-pink-20');
    expect(suggestion.reasons.length).toBeGreaterThan(0);
    expect(suggestion.reasons.join(' ')).toMatch(/vibe/);
  });

  test('accepted items influence the next suggestion (pink balloons → purple star garland)', () => {
    let ev = makeEvent({ vibes: ['cute', 'party'] });
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    const { suggestion } = suggestNext(ev, 'decorations', 'banner', ctx);
    expect(suggestion.product.id).toBe('ban-purple-stars');
    expect(suggestion.reasons).toContain('Goes with your Pink Balloon Set');
  });

  test('"too expensive" → next suggestion is cheaper', () => {
    let ev = makeEvent({ vibes: ['glam'] });
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'expensive');
    const next = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(next.lineTotal).toBeLessThan(first.lineTotal);
    expect(next.reasons[0]).toBe('Cheaper than the option you declined');
  });

  test('"don’t like the colour" → a different colour', () => {
    let ev = makeEvent();
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'colour');
    const next = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(next.product.colour).not.toBe(first.product.colour);
  });

  test('"don’t like the style" → a different style', () => {
    let ev = makeEvent();
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'style');
    expect(suggestNext(ev, 'decorations', 'balloons', ctx).suggestion.product.style).not.toBe(first.product.style);
  });

  test('"wrong size" → a different pack size', () => {
    let ev = makeEvent();
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'size');
    expect(suggestNext(ev, 'decorations', 'balloons', ctx).suggestion.product.packSize).not.toBe(first.product.packSize);
  });

  test('"doesn’t fit my theme" → stronger vibe match', () => {
    let ev = makeEvent({ vibes: ['glam', 'party'] });
    const rainbow = { product: getProduct('bal-rainbow-50'), qty: 1, lineTotal: 7 };
    ev = applyDecline(ev, rainbow, 'theme'); // overlap 1 (party)
    const next = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(next.product.vibes.filter((v) => ev.vibes.includes(v)).length).toBeGreaterThanOrEqual(2);
  });

  test('"don’t like the shop" → that shop is avoided for the rest of the event', () => {
    let ev = makeEvent({ categories: ['decorations', 'favours'] });
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'shop');
    const shop = first.product.retailer;
    expect(rankCandidates(ev, 'decorations', 'balloons', ctx).list.every((s) => s.product.retailer !== shop)).toBe(true);
    expect(rankCandidates(ev, 'favours', 'bags', ctx).list.every((s) => s.product.retailer !== shop)).toBe(true);
  });

  test('"I just don’t like this option" only excludes that product', () => {
    let ev = makeEvent();
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    const before = rankCandidates(ev, 'decorations', 'balloons', ctx).list.map((s) => s.product.id);
    ev = applyDecline(ev, first, 'dislike');
    const after = rankCandidates(ev, 'decorations', 'balloons', ctx).list.map((s) => s.product.id);
    expect(after).toEqual(before.filter((id) => id !== first.product.id));
  });

  test('declined products are never suggested again', () => {
    let ev = makeEvent();
    for (let i = 0; i < 3; i++) {
      ev = applyDecline(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion, 'dislike');
    }
    const ids = rankCandidates(ev, 'decorations', 'balloons', ctx).list.map((s) => s.product.id);
    ev.declines.forEach((d) => expect(ids).not.toContain(d.productId));
  });

  test('when constraints rule everything out, it relaxes and says so', () => {
    let ev = makeEvent();
    const cheapest = { product: getProduct('bal-pink-20'), qty: 1, lineTotal: 5 };
    ev = applyDecline(ev, cheapest, 'expensive');
    const res = suggestNext(ev, 'decorations', 'balloons', ctx);
    expect(res.relaxed).toBe(true);
    expect(res.suggestion).not.toBeNull();
  });

  test('runs out of options gracefully', () => {
    let ev = makeEvent();
    let res = suggestNext(ev, 'decorations', 'balloons', ctx);
    while (res.suggestion) {
      ev = applyDecline(ev, res.suggestion, 'dislike');
      res = suggestNext(ev, 'decorations', 'balloons', ctx);
    }
    expect(res.remaining).toBe(0);
  });

  test('"Something else" notes are interpreted by keyword only', () => {
    expect(interpretNote('a bit too pricey for me')).toEqual(['expensive']);
    expect(interpretNote('wrong colour')).toEqual(['colour']);
    expect(interpretNote('meh')).toEqual([]);
  });

  test('memory profile and saved ideas boost matching products', () => {
    const ev = makeEvent({ vibes: [] });
    const profile = { colours: ['gold'], styles: [], vibes: [], shopsLike: [], shopsAvoid: [], cake: null };
    const { suggestion } = suggestNext(ev, 'decorations', 'balloons', { profile, savedProductIds: [] });
    expect(suggestion.product.colour).toBe('gold');
    expect(suggestion.reasons).toContain('In colours you usually love');
    const saved = suggestNext(ev, 'decorations', 'balloons', { profile: null, savedProductIds: ['bal-white-arch'] });
    expect(saved.suggestion.reasons).toContain('From your saved ideas');
  });

  test('colour compatibility', () => {
    expect(coloursCompatible('pink', 'purple')).toBe(true);
    expect(coloursCompatible('pink', 'white')).toBe(true);
    expect(coloursCompatible('green', 'pink')).toBe(false);
  });
});

describe('categories and completion', () => {
  test('accepting one item does NOT complete a category', () => {
    let ev = makeEvent();
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    expect(categoryProgress(ev, 'decorations')).toEqual({ resolved: 1, total: 4, status: 'in_progress' });
    expect(nextOpenSlot(ev, 'decorations').id).toBe('banner');
  });

  test('a decline alone moves a category to in progress', () => {
    let ev = makeEvent();
    ev = applyDecline(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion, 'dislike');
    expect(categoryProgress(ev, 'decorations').status).toBe('in_progress');
  });

  test('category completes once every slot is resolved (accept, own item or skip)', () => {
    let ev = makeEvent();
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    ev = applyOwnItem(ev, { categoryId: 'decorations', slotId: 'banner', name: 'Mum’s banner', price: '0', qty: '1' });
    ev = applySkip(ev, 'decorations', 'table');
    expect(isPlanComplete(ev)).toBe(false);
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'backdrop', ctx).suggestion);
    expect(categoryProgress(ev, 'decorations').status).toBe('complete');
    expect(isPlanComplete(ev)).toBe(true);
    expect(nextCategoryId(ev)).toBeNull();
  });

  test('nextCategoryId moves on to the next unfinished category', () => {
    let ev = makeEvent({ categories: ['invitations', 'cake'] });
    ev = applyAccept(ev, suggestNext(ev, 'invitations', 'invites', ctx).suggestion);
    expect(nextCategoryId(ev, 'invitations')).toBe('cake');
  });
});

describe('change, remove and edit', () => {
  test('CHANGE ≠ DECLINE: replacing records no decline', () => {
    let ev = makeEvent();
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    const item = ev.items[0];
    const alt = rankCandidates(ev, 'decorations', 'balloons', ctx, { excludeIds: [item.productId] }).list[0];
    ev = applyReplace(ev, item.id, alt);
    expect(ev.declines).toHaveLength(0);
    expect(ev.items).toHaveLength(1);
    expect(ev.items[0].productId).toBe(alt.product.id);
  });

  test('own replacement item is added to the plan with its price', () => {
    let ev = makeEvent();
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    ev = applyOwnItem(ev, { categoryId: 'decorations', slotId: 'balloons', name: 'My balloons', price: '3.5', qty: '2' }, ev.items[0].id);
    expect(ev.items[0].custom).toBe(true);
    expect(budgetSummary(ev).total).toBe(7);
  });

  test('remove re-opens the slot; "no longer needed" resolves it', () => {
    let ev = makeEvent();
    ev = applyAccept(ev, suggestNext(ev, 'decorations', 'balloons', ctx).suggestion);
    const id = ev.items[0].id;
    expect(nextOpenSlot(applyRemove(ev, id, 'changed_mind'), 'decorations').id).toBe('balloons');
    expect(nextOpenSlot(applyRemove(ev, id, 'not_needed'), 'decorations').id).toBe('banner');
    expect(applyRemove(ev, id, 'expensive').declines).toHaveLength(0);
  });

  test('guest count change flags per-guest quantities for review', () => {
    const before = EXAMPLE_PARTY;
    const after = applyEdit(before, { guests: 20 });
    const ch = analyseChanges(before, after);
    expect(ch.guests.from).toBe(12);
    expect(ch.guests.to).toBe(20);
    const names = ch.guests.items.map((i) => i.name);
    expect(names).toContain('Fruit Cups');
    expect(names).not.toContain('Star Piñata');
    expect(changesNeedReview(ch)).toBe(true);
  });

  test('budget cut below total is flagged', () => {
    const ch = analyseChanges(EXAMPLE_PARTY, applyEdit(EXAMPLE_PARTY, { budget: 100 }));
    expect(ch.budget.overBy).toBeGreaterThan(0);
  });

  test('deselecting a category removes its items', () => {
    const after = applyEdit(EXAMPLE_PARTY, { categories: EXAMPLE_PARTY.categories.filter((c) => c !== 'cake') });
    expect(after.items.some((i) => i.category === 'cake')).toBe(false);
    expect(analyseChanges(EXAMPLE_PARTY, after).removedCategories).toEqual(['cake']);
  });
});

describe('events', () => {
  test('example party is complete and within budget', () => {
    expect(isPlanComplete(EXAMPLE_PARTY)).toBe(true);
    const b = budgetSummary(EXAMPLE_PARTY);
    expect(b.total).toBe(287);
    expect(b.over).toBe(false);
  });

  test('draft → event', () => {
    const d = { ...newDraft(), type: 'birthday', name: ' Mia ', date: '2026-11-14', venue: { mode: 'own', name: 'Park' }, budgetText: '$300' };
    const ev = createEventFromDraft(d);
    expect(ev.name).toBe('Mia');
    expect(ev.budget).toBe(300);
    expect(ev.items).toEqual([]);
    expect(ev.status).toBe('planning');
  });
});
