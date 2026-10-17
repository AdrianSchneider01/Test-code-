import { applyAccept, applyDecline, computeQty } from '../src/logic/engine';
import {
  DEFAULT_MEMORY,
  addManualMemory,
  changeMemory,
  clearAllMemory,
  effectiveMemories,
  eventLearnings,
  learnedMemories,
  profileFromMemories,
} from '../src/logic/memory';
import { getProduct } from '../src/data/catalog';

function savedEvent(id, productIds, { savedAt = '2026-10-01T00:00:00.000Z', budget = 200, type = 'birthday', declines = [] } = {}) {
  let ev = {
    id,
    type,
    guests: 10,
    budget,
    vibes: ['glam'],
    categories: ['decorations', 'cake'],
    items: [],
    declines: [],
    skipped: [],
    status: 'saved',
    savedAt,
  };
  productIds.forEach((pid) => {
    const product = getProduct(pid);
    ev = applyAccept(ev, { product, qty: computeQty(product, 10) });
  });
  declines.forEach(([pid, reason]) => {
    const product = getProduct(pid);
    ev = applyDecline(ev, { product, qty: 1, lineTotal: product.price }, reason);
  });
  return ev;
}

const mem = { ...DEFAULT_MEMORY };

describe('memory patterns', () => {
  test('one choice is NOT a permanent preference', () => {
    const events = [savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit'])];
    expect(learnedMemories(events, mem).find((m) => m.type === 'colour')).toBeUndefined();
  });

  test('repeated choices become a learned pattern with a count', () => {
    const events = [savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit']), savedEvent('b', ['invites-16-piece-magical-party-invitations']), savedEvent('c', ['bags-meteor-party-8pc-loot-gift-bags-unicorn'])];
    const purple = learnedMemories(events, mem).find((m) => m.key === 'colour:purple');
    expect(purple.count).toBe(3);
    expect(purple.text).toBe('You’ve chosen purple for 3 events');
  });

  test('unsaved events do not teach anything', () => {
    const e1 = { ...savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit']), status: 'planning' };
    const e2 = savedEvent('b', ['invites-16-piece-magical-party-invitations']);
    expect(learnedMemories([e1, e2], mem).find((m) => m.type === 'colour')).toBeUndefined();
  });

  test('budget range and cake vs cupcakes', () => {
    const events = [
      savedEvent('a', ['cake-woolworths-mini-iced-mudcake-cupcakes-12'], { budget: 150 }),
      savedEvent('b', ['cake-woolworths-vanilla-cupcakes-with-butterc'], { budget: 300 }),
    ];
    const list = learnedMemories(events, mem);
    expect(list.find((m) => m.type === 'budget').value).toBe('$150–$300');
    expect(list.find((m) => m.type === 'cake').value).toBe('cupcakes');
  });

  test('avoided shops become a pattern', () => {
    const events = [
      savedEvent('a', [], { declines: [['balloons-61-piece-magical-balloon-garland-pack', 'shop']] }),
      savedEvent('b', [], { declines: [['bags-8-pack-fabric-loot-bags', 'shop']] }),
    ];
    expect(learnedMemories(events, mem).find((m) => m.key === 'shopAvoid:Kmart')).toBeTruthy();
  });

  test('forget hides a learned memory', () => {
    const events = [savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit']), savedEvent('b', ['invites-16-piece-magical-party-invitations'])];
    const purple = learnedMemories(events, mem).find((m) => m.key === 'colour:purple');
    const m2 = changeMemory(mem, purple, 'pink');
    const list = effectiveMemories(events, m2);
    expect(list.find((m) => m.key === 'colour:purple')).toBeUndefined();
    expect(list.find((m) => m.type === 'colour' && m.value === 'pink' && m.source === 'manual')).toBeTruthy();
  });

  test('manual single-value memories override learned ones', () => {
    const events = [savedEvent('a', [], { budget: 150 }), savedEvent('b', [], { budget: 300 })];
    const m2 = addManualMemory(mem, 'budget', '$500–$800');
    const budgets = effectiveMemories(events, m2).filter((m) => m.type === 'budget');
    expect(budgets).toHaveLength(1);
    expect(budgets[0].value).toBe('$500–$800');
  });

  test('clear all ignores events saved before clearing', () => {
    const events = [savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit']), savedEvent('b', ['invites-16-piece-magical-party-invitations'])];
    const cleared = clearAllMemory(addManualMemory(mem, 'colour', 'gold'), '2026-10-02T00:00:00.000Z');
    expect(effectiveMemories(events, cleared)).toEqual([]);
    const later = savedEvent('c', ['bags-meteor-party-8pc-loot-gift-bags-unicorn'], { savedAt: '2026-10-03T00:00:00.000Z' });
    const later2 = savedEvent('d', ['balloons-unique-purple-galaxy-balloon-garland-kit'], { savedAt: '2026-10-04T00:00:00.000Z' });
    expect(learnedMemories([...events, later, later2], cleared).find((m) => m.key === 'colour:purple').count).toBe(2);
  });

  test('profile is built from effective memories', () => {
    const m2 = addManualMemory(addManualMemory(mem, 'colour', 'gold'), 'shopAvoid', 'Coles');
    const profile = profileFromMemories(effectiveMemories([], m2));
    expect(profile.colours).toEqual(['gold']);
    expect(profile.shopsAvoid).toEqual(['Coles']);
  });

  test('event learnings summarise choices and declines', () => {
    const ev = savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit'], { declines: [['balloons-61-piece-magical-balloon-garland-pack', 'expensive']] });
    const lines = eventLearnings(ev).join('\n');
    expect(lines).toMatch(/purple/);
    expect(lines).toMatch(/Too expensive/);
  });
});

describe('AI party reviews feed memory patterns', () => {
  const insights = (o) => ({ colours: [], styles: [], vibes: [], shopsLiked: [], shopsAvoided: [], notes: [], summary: '', ...o });

  test('AI findings count, but still need 2+ saved parties', () => {
    const a = { ...savedEvent('a', []), aiInsights: insights({ vibes: ['elegant'], colours: ['gold'] }) };
    expect(learnedMemories([a], mem).find((m) => m.key === 'vibe:elegant')).toBeUndefined();
    const b = { ...savedEvent('b', []), aiInsights: insights({ vibes: ['elegant'] }) };
    expect(learnedMemories([a, b], mem).find((m) => m.key === 'vibe:elegant').count).toBe(2);
    expect(learnedMemories([a, b], mem).find((m) => m.key === 'colour:gold')).toBeUndefined();
  });

  test('a choice and an AI finding in the same party count once', () => {
    const a = { ...savedEvent('a', ['balloons-partyrama-gold-4m-balloon-arch-kit']), aiInsights: insights({ colours: ['gold'] }) };
    const b = savedEvent('b', ['banner-party-maker-happy-birthday-letter-banner']);
    expect(learnedMemories([a, b], mem).find((m) => m.key === 'colour:gold').count).toBe(2);
  });

  test('"What I learned" shows the AI summary and notes first', () => {
    const ev = { ...savedEvent('a', ['balloons-unique-purple-galaxy-balloon-garland-kit']), aiInsights: insights({ summary: 'A glam purple night.', notes: ['Likes a statement balloon'] }) };
    const lines = eventLearnings(ev);
    expect(lines[0]).toBe('✨ A glam purple night.');
    expect(lines[1]).toBe('✨ Likes a statement balloon');
  });
});
