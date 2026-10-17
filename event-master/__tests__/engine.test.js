import { getProduct, CATALOG } from '../src/data/catalog';
import { CATEGORIES } from '../src/data/categories';
import {
  analyseChanges,
  applyAccept,
  applyDecline,
  applyEdit,
  applyOwnItem,
  applyQty,
  applyRemove,
  applyReplace,
  applySkip,
  budgetCrossing,
  budgetSummary,
  categoryProgress,
  changesNeedReview,
  computeQty,
  findBudgetAlert,
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
const PINK = 'balloons-46-piece-pink-balloon-garland'; // Kmart, $6, pink, cute

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
      // Real products only: a product page on the shop's own website, with the date the price was checked.
      expect(p.url).toMatch(/^https:\/\/(www\.)?(kmart|bigw|officeworks|woolworths|coles|target|aldi|lincraft)\.com\.au\/|^https:\/\/(www\.)?(spotlightstores|amazon\.com\.au)/);
      expect(p.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sample).toBeUndefined();
    });
  });

  test('every slot shops sell has at least three real options (playlists are not sold)', () => {
    CATEGORIES.forEach((c) =>
      c.slots.forEach((s) => {
        const n = CATALOG.filter((p) => p.category === c.id && p.slot === s.id).length;
        if (s.id === 'playlist') expect(n).toBe(0);
        else expect(n).toBeGreaterThanOrEqual(3);
      }),
    );
  });
});

describe('quantities and budget', () => {
  test('per-guest quantities round up; fixed stay fixed', () => {
    const bags = getProduct('bags-8-pack-fabric-loot-bags'); // 8 bags, one pack per 8 guests
    expect(computeQty(bags, 8)).toBe(1);
    expect(computeQty(bags, 9)).toBe(2);
    expect(computeQty(getProduct(PINK), 40)).toBe(1);
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
    expect(suggestion.product.colour).toBe('pink');
    expect(suggestion.product.vibes).toContain('cute');
    expect(suggestion.reasons.length).toBeGreaterThan(0);
    expect(suggestion.reasons.join(' ')).toMatch(/vibe/);
  });

  test('accepted items influence the next suggestion (pink balloons → a matching pink banner)', () => {
    let ev = makeEvent({ vibes: ['cute', 'party'] });
    const balloons = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyAccept(ev, balloons);
    const { suggestion } = suggestNext(ev, 'decorations', 'banner', ctx);
    expect(['pink', 'purple', 'white', 'gold']).toContain(suggestion.product.colour);
    expect(suggestion.reasons).toContain(`Goes with your ${balloons.product.name}`);
  });

  test('"too expensive" → next suggestion is cheaper', () => {
    let ev = makeEvent({ vibes: ['glam'] });
    const first = { product: getProduct('balloons-artwrap-confetti-balloon-garland-kit-bla'), qty: 1, lineTotal: 10.99 };
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
    const rainbow = { product: getProduct('balloons-unique-multi-colour-pre-filled-confetti'), qty: 1, lineTotal: 4.99 };
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
    const cheapest = { product: getProduct('balloons-12-piece-gold-and-silver-chrome-balloons'), qty: 1, lineTotal: 2.5 };
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
    const saved = suggestNext(ev, 'decorations', 'balloons', { profile: null, savedProductIds: ['balloons-five-star-navy-balloons-30cm-pack-of-18'] });
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
    // Flagged: exactly the per-guest items whose suggested quantity changes for 20 guests.
    const changes = (i) => computeQty(getProduct(i.productId), 12) !== computeQty(getProduct(i.productId), 20);
    expect(before.items.filter(changes).length).toBeGreaterThan(0);
    before.items.filter(changes).forEach((i) => expect(names).toContain(i.name));
    before.items.filter((i) => getProduct(i.productId).qty.type === 'fixed').forEach((i) => expect(names).not.toContain(i.name));
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
    expect(b.total).toBeGreaterThan(0);
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

describe('budget alerts', () => {
  let n = 0;
  const withItem = (ev, price) => ({
    ...ev,
    items: [...ev.items, { id: `i${++n}`, productId: null, custom: true, category: 'decorations', slot: 'balloons', name: `Item ${price}`, unitPrice: price, qty: 1 }],
  });

  test('alerts when the total reaches the budget exactly', () => {
    const before = withItem(makeEvent({ budget: 50 }), 30);
    const after = withItem(before, 20);
    expect(budgetCrossing(before, after)).toEqual({ type: 'hit', total: 50, budget: 50, overBy: 0 });
  });

  test('alerts when the total goes over the budget', () => {
    const before = withItem(makeEvent({ budget: 50 }), 30);
    const after = withItem(before, 25);
    expect(budgetCrossing(before, after)).toEqual({ type: 'over', total: 55, budget: 50, overBy: 5 });
  });

  test('going from exactly at budget to over still alerts', () => {
    const before = withItem(makeEvent({ budget: 50 }), 50);
    expect(budgetCrossing(before, withItem(before, 1)).type).toBe('over');
  });

  test('no alert while under, when already over, when the total drops, or with no budget', () => {
    const base = makeEvent({ budget: 50 });
    expect(budgetCrossing(base, withItem(base, 10))).toBeNull();
    const over = withItem(base, 60);
    expect(budgetCrossing(over, withItem(over, 5))).toBeNull();
    expect(budgetCrossing(over, base)).toBeNull();
    const noBudget = makeEvent({ budget: null });
    expect(budgetCrossing(noBudget, withItem(noBudget, 500))).toBeNull();
  });

  test('budget edits are left to the review screen', () => {
    const before = withItem(makeEvent({ budget: 100 }), 80);
    expect(budgetCrossing(before, { ...before, budget: 50 })).toBeNull();
  });

  test('quantity increases count too, and the alert names the cause', () => {
    let ev = makeEvent({ budget: 20, guests: 10 });
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyAccept(ev, first);
    const id = ev.items[0].id;
    const qty = Math.floor(20 / first.product.price) + 1; // just over $20
    const after = applyQty(ev, id, qty);
    const alert = findBudgetAlert([ev], [after]);
    expect(alert.type).toBe('over');
    expect(alert.overBy).toBeCloseTo(qty * first.product.price - 20, 2);
    expect(alert.causeName).toBe(first.product.name);
    expect(alert.previous).toBe(ev);
  });

  test('new or unchanged events never alert', () => {
    const ev = withItem(makeEvent({ budget: 10 }), 50);
    expect(findBudgetAlert([], [ev])).toBeNull();
    expect(findBudgetAlert([ev], [ev])).toBeNull();
  });
});

describe('venues', () => {
  // eslint-disable-next-line import/first
  const E = require('../src/logic/engine');
  // eslint-disable-next-line import/first
  const { rankVenueTypes } = require('../src/data/venues');
  const looking = () => makeEvent({ venue: { mode: 'search', name: 'Bondi' }, budget: 300, guests: 25 });

  test('shortlist add / update / remove, with tidy numbers and links', () => {
    let ev = E.applyAddVenue(looking(), { name: ' Bondi Hall ', area: 'Bondi', capacity: '80', cost: '$150', link: 'bondihall.example' });
    const v = E.venueShortlist(ev)[0];
    expect(v).toMatchObject({ name: 'Bondi Hall', capacity: 80, cost: 150, link: 'https://bondihall.example', status: 'considering' });
    ev = E.applyUpdateVenue(ev, v.id, { cost: '120' });
    expect(E.venueShortlist(ev)[0].cost).toBe(120);
    expect(E.venueShortlist(E.applyRemoveVenue(ev, v.id))).toEqual([]);
  });

  test('only "Booked" sets the venue and adds the hire cost to the budget', () => {
    let ev = E.applyAddVenue(looking(), { name: 'Bondi Hall', area: 'Bondi', cost: '150' });
    const id = E.venueShortlist(ev)[0].id;
    ev = E.applyVenueStatus(ev, id, 'available');
    expect(ev.venue).toEqual({ mode: 'search', name: 'Bondi' });
    expect(E.budgetSummary(ev).total).toBe(0);
    ev = E.applyVenueStatus(ev, id, 'booked');
    expect(ev.venue).toEqual({ mode: 'own', name: 'Bondi Hall, Bondi' });
    expect(E.budgetSummary(ev).total).toBe(150);
  });

  test('booking another venue un-books the first; un-booking goes back to looking', () => {
    let ev = E.applyAddVenue(looking(), { name: 'A', cost: '100' });
    ev = E.applyAddVenue(ev, { name: 'B', cost: '200' });
    const [a, b] = E.venueShortlist(ev).map((v) => v.id);
    ev = E.applyVenueStatus(ev, a, 'booked');
    ev = E.applyVenueStatus(ev, b, 'booked');
    expect(E.venueShortlist(ev).map((v) => v.status)).toEqual(['available', 'booked']);
    expect(E.venueCost(ev)).toBe(200);
    ev = E.applyVenueStatus(ev, b, 'enquired');
    expect(ev.venue).toEqual({ mode: 'search', name: 'Bondi' });
    expect(E.venueCost(ev)).toBe(0);
  });

  test('booking a venue that blows the budget raises a budget alert naming it', () => {
    let ev = E.applyAddVenue(looking(), { name: 'Grand Room', cost: '400' });
    const after = E.applyVenueStatus(ev, E.venueShortlist(ev)[0].id, 'booked');
    const alert = E.findBudgetAlert([ev], [after]);
    expect(alert.type).toBe('over');
    expect(alert.causeName).toBe('Booking Grand Room');
  });

  test('venue types are ranked for the party', () => {
    const top = rankVenueTypes(makeEvent({ guests: 120, vibes: ['elegant', 'glam'], type: 'celebration' }))[0];
    expect(top.type.id).toBe('function');
    expect(top.fits).toBe(true);
    const small = rankVenueTypes(makeEvent({ guests: 8, vibes: ['relaxed'], budget: 100 }))[0];
    expect(['home', 'park']).toContain(small.type.id);
  });

  test('changing to a new venue flags space-dependent items; a date change flags invitations', () => {
    let ev = makeEvent({ categories: ['decorations', 'invitations'], venue: { mode: 'own', name: 'Home' } });
    ev = E.applyAccept(ev, E.suggestNext(ev, 'decorations', 'backdrop', ctx).suggestion);
    ev = E.applyAccept(ev, E.suggestNext(ev, 'invitations', 'invites', ctx).suggestion);
    const after = E.applyEdit(ev, { venue: { mode: 'own', name: 'Community Hall' }, date: '2026-12-24' });
    const ch = E.analyseChanges(ev, after);
    expect(ch.venue.items).toHaveLength(1);
    expect(ch.date).toEqual({ from: '2026-12-01', to: '2026-12-24' });
    expect(E.changesNeedReview(ch)).toBe(true);
  });
});

describe('hire services', () => {
  // eslint-disable-next-line import/first
  const E = require('../src/logic/engine');
  // eslint-disable-next-line import/first
  const S = require('../src/data/services');
  const party = () => makeEvent({ venue: { mode: 'search', name: 'Bondi' }, budget: 300, categories: ['decorations', 'activities'] });

  test('every kind of service points at a real part of the plan', () => {
    S.SERVICE_TYPES.forEach((t) => {
      const cat = CATEGORIES.find((c) => c.id === t.category);
      expect(cat.slots.some((s) => s.id === t.slot)).toBe(true);
      expect(t.ask.length).toBeGreaterThan(0);
    });
  });

  test('Google Maps search near the party area', () => {
    const url = S.mapsSearchUrl(S.getServiceType('castle'), 'Bondi');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=jumping%20castle%20hire%20near%20Bondi');
    expect(E.serviceArea(party())).toBe('Bondi');
    expect(E.serviceArea(E.applyServiceArea(party(), ' Manly '))).toBe('Manly');
  });

  test('booking a service adds it to the plan at its quote and resolves that part', () => {
    let ev = E.applyAddService(party(), { name: ' Bouncy Fun Co ', typeId: 'castle', quote: '$220', link: 'bouncyfun.example' });
    const sv = E.serviceShortlist(ev)[0];
    expect(sv).toMatchObject({ name: 'Bouncy Fun Co', quote: 220, link: 'https://bouncyfun.example', status: 'considering' });
    expect(budgetSummary(ev).total).toBe(0);
    ev = E.applyServiceStatus(ev, sv.id, 'booked');
    expect(budgetSummary(ev).total).toBe(220);
    expect(ev.items[0]).toMatchObject({ service: true, category: 'activities', slot: 'activity', name: 'Bouncy Fun Co' });
    expect(categoryProgress(ev, 'activities').resolved).toBe(1);
    // A new quote updates the plan; un-booking takes it out again.
    ev = E.applyUpdateService(ev, sv.id, { quote: '250' });
    expect(budgetSummary(ev).total).toBe(250);
    ev = E.applyServiceStatus(ev, sv.id, 'quoted');
    expect(ev.items).toHaveLength(0);
  });

  test('booking a DJ adds music to the party if it was not chosen', () => {
    let ev = E.applyAddService(party(), { name: 'DJ Sam', typeId: 'dj', quote: '400' });
    ev = E.applyServiceStatus(ev, E.serviceShortlist(ev)[0].id, 'booked');
    expect(ev.categories).toContain('music');
  });

  test('booking can push the party over budget and the alert names it', () => {
    let ev = E.applyAddService(party(), { name: 'Big Band', typeId: 'musician', quote: '350' });
    const after = E.applyServiceStatus(ev, E.serviceShortlist(ev)[0].id, 'booked');
    const alert = findBudgetAlert([ev], [after]);
    expect(alert.type).toBe('over');
    expect(alert.causeName).toBe('Big Band');
  });

  test('removing the booked service from the plan un-books it but keeps it shortlisted', () => {
    let ev = E.applyAddService(party(), { name: 'Paint Pals', typeId: 'facepaint', quote: '150' });
    const id = E.serviceShortlist(ev)[0].id;
    ev = E.applyServiceStatus(ev, id, 'booked');
    ev = E.applyRemove(ev, ev.items[0].id, 'changed_mind');
    expect(ev.items).toHaveLength(0);
    expect(E.serviceShortlist(ev)[0].status).toBe('quoted');
    expect(E.applyRemoveService(E.applyServiceStatus(ev, id, 'booked'), id).items).toHaveLength(0);
  });
});
