import { getProduct } from '../src/data/catalog';
import { AI_MEMORY_TYPES, TASKS, sanitizeOutput, validateInput } from '../src/ai/contract';
import {
  applyDecline,
  applyRefinement,
  applyVibeHints,
  categoryProgress,
  rankCandidates,
  removeRefinement,
  suggestNext,
} from '../src/logic/engine';
import { MEMORY_TYPES, eventLearnings } from '../src/logic/memory';

const ctx = { profile: null, savedProductIds: [] };
const base = () => ({
  id: 'e', guests: 10, budget: 150, vibes: ['cute', 'fun'], categories: ['decorations'],
  items: [], declines: [], skipped: [], status: 'planning',
});

describe('AI contract', () => {
  test('memory types match the memory module', () => {
    expect(AI_MEMORY_TYPES.sort()).toEqual(MEMORY_TYPES.map((t) => t.id).sort());
  });

  test('sanitiser drops anything outside the vocabulary', () => {
    const out = sanitizeOutput('refine', {
      preferVibes: ['Elegant', 'spooky'], preferColours: ['gold'], avoidColours: ['pink', 'pink'],
      preferStyles: ['luxe'], avoidStyles: ['weird'], maxPrice: -5, summary: '  More   elegant  ',
    });
    expect(out).toEqual({
      preferVibes: ['elegant'], preferColours: ['gold'], avoidColours: ['pink'], preferStyles: ['luxe'],
      avoidStyles: [], maxPrice: null, summary: 'More elegant',
    });
    expect(sanitizeOutput('feedback', null).reasons).toEqual([]);
    expect(sanitizeOutput('nope', {})).toBeNull();
  });

  test('every task validates a realistic input from the app', () => {
    const product = { name: 'Pink Balloon Set', colour: 'pink', style: 'cute', retailer: 'Party Lane', lineTotal: 10 };
    const event = { type: 'birthday', vibes: ['cute'], guests: 10, budget: 150, categories: ['decorations'] };
    const inputs = {
      feedback: { note: 'too bright', product },
      refine: { text: 'more elegant', event, product },
      vibe: { text: 'under the sea' },
      memories: { text: 'I love gold' },
      profileSummary: { memories: ['You’ve chosen purple for 3 events'] },
      explain: { product, reasons: ['Matches your Cute vibe'], event },
      ideas: { event },
    };
    Object.keys(TASKS).forEach((t) => expect(validateInput(t, inputs[t])).toBe(true));
    expect(validateInput('feedback', { note: 'x'.repeat(700), product })).toBe(false);
  });
});

describe('engine uses AI results', () => {
  test('AI feedback replaces keyword guessing and avoids the named colour', () => {
    let ev = base();
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    // The note has no keywords, but AI understood it as a colour complaint.
    ev = applyDecline(ev, first, 'other', 'feels a bit much for little ones', {
      reasons: ['colour'], avoidColours: ['pink'], preferColours: ['white'], preferStyles: [], preferVibes: [], summary: 'Softer colours',
    });
    const next = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(next.product.colour).not.toBe('pink');
    expect(next.reasons).toContain('A different colour, as you asked');
  });

  test('"Ask Event Master" refinements steer suggestions and can be removed', () => {
    let ev = base();
    expect(suggestNext(ev, 'decorations', 'balloons', ctx).suggestion.product.id).toBe('bal-pink-20');
    ev = applyRefinement(ev, 'something more elegant', {
      preferVibes: ['elegant'], preferColours: ['gold'], avoidColours: [], preferStyles: [], avoidStyles: [], maxPrice: null, summary: 'More elegant',
    });
    const next = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(next.product.id).toBe('bal-gold-confetti');
    expect(next.reasons).toContain('As you asked: More elegant');
    const back = removeRefinement(ev, ev.refinements[0].id);
    expect(suggestNext(back, 'decorations', 'balloons', ctx).suggestion.product.id).toBe('bal-pink-20');
  });

  test('a refinement with a price cap pushes over-cap options down', () => {
    let ev = { ...base(), vibes: ['glam'] };
    ev = applyRefinement(ev, 'under $10 please', {
      preferVibes: [], preferColours: [], avoidColours: [], preferStyles: [], avoidStyles: [], maxPrice: 10, summary: 'Under $10',
    });
    expect(suggestNext(ev, 'decorations', 'balloons', ctx).suggestion.lineTotal).toBeLessThanOrEqual(10);
  });

  test('vibe hints from free text count as vibes', () => {
    let ev = { ...base(), vibes: ['other'], otherVibe: 'disco night' };
    ev = applyVibeHints(ev, { vibes: ['party', 'glam'], colours: ['silver'], styles: ['retro'], summary: 'Disco sparkle' });
    const s = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    expect(s.product.vibes.some((v) => ['party', 'glam'].includes(v))).toBe(true);
    expect(eventLearnings(ev).join(' ')).toMatch(/Disco sparkle/);
  });

  test('theme declines are now enforced as a filter', () => {
    let ev = { ...base(), vibes: ['glam', 'party'] };
    ev = applyDecline(ev, { product: getProduct('bal-rainbow-50'), qty: 1, lineTotal: 7 }, 'theme');
    const list = rankCandidates(ev, 'decorations', 'balloons', ctx).list;
    list.forEach((s) => expect(s.product.vibes.filter((v) => ev.vibes.includes(v)).length).toBeGreaterThanOrEqual(2));
    expect(categoryProgress(ev, 'decorations').status).toBe('in_progress');
  });
});
