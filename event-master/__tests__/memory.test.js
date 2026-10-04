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
    const events = [savedEvent('a', ['bal-purple-chrome'])];
    expect(learnedMemories(events, mem).find((m) => m.type === 'colour')).toBeUndefined();
  });

  test('repeated choices become a learned pattern with a count', () => {
    const events = [savedEvent('a', ['bal-purple-chrome']), savedEvent('b', ['ban-purple-stars']), savedEvent('c', ['tab-purple-galaxy'])];
    const purple = learnedMemories(events, mem).find((m) => m.key === 'colour:purple');
    expect(purple.count).toBe(3);
    expect(purple.text).toBe('You’ve chosen purple for 3 events');
  });

  test('unsaved events do not teach anything', () => {
    const e1 = { ...savedEvent('a', ['bal-purple-chrome']), status: 'planning' };
    const e2 = savedEvent('b', ['ban-purple-stars']);
    expect(learnedMemories([e1, e2], mem).find((m) => m.type === 'colour')).toBeUndefined();
  });

  test('budget range and cake vs cupcakes', () => {
    const events = [
      savedEvent('a', ['cake-galaxy-cupcakes'], { budget: 150 }),
      savedEvent('b', ['cake-gold-cupcakes'], { budget: 300 }),
    ];
    const list = learnedMemories(events, mem);
    expect(list.find((m) => m.type === 'budget').value).toBe('$150–$300');
    expect(list.find((m) => m.type === 'cake').value).toBe('cupcakes');
  });

  test('avoided shops become a pattern', () => {
    const events = [
      savedEvent('a', [], { declines: [['bal-rainbow-50', 'shop']] }),
      savedEvent('b', [], { declines: [['bag-budget', 'shop']] }),
    ];
    expect(learnedMemories(events, mem).find((m) => m.key === 'shopAvoid:Budget Bash')).toBeTruthy();
  });

  test('forget hides a learned memory', () => {
    const events = [savedEvent('a', ['bal-purple-chrome']), savedEvent('b', ['ban-purple-stars'])];
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
    const events = [savedEvent('a', ['bal-purple-chrome']), savedEvent('b', ['ban-purple-stars'])];
    const cleared = clearAllMemory(addManualMemory(mem, 'colour', 'gold'), '2026-10-02T00:00:00.000Z');
    expect(effectiveMemories(events, cleared)).toEqual([]);
    const later = savedEvent('c', ['tab-purple-galaxy'], { savedAt: '2026-10-03T00:00:00.000Z' });
    const later2 = savedEvent('d', ['bal-purple-chrome'], { savedAt: '2026-10-04T00:00:00.000Z' });
    expect(learnedMemories([...events, later, later2], cleared).find((m) => m.key === 'colour:purple').count).toBe(2);
  });

  test('profile is built from effective memories', () => {
    const m2 = addManualMemory(addManualMemory(mem, 'colour', 'gold'), 'shopAvoid', 'Budget Bash');
    const profile = profileFromMemories(effectiveMemories([], m2));
    expect(profile.colours).toEqual(['gold']);
    expect(profile.shopsAvoid).toEqual(['Budget Bash']);
  });

  test('event learnings summarise choices and declines', () => {
    const ev = savedEvent('a', ['bal-purple-chrome'], { declines: [['bal-rainbow-50', 'expensive']] });
    const lines = eventLearnings(ev).join('\n');
    expect(lines).toMatch(/purple/);
    expect(lines).toMatch(/Too expensive/);
  });
});
