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
import { applyPick, buildPickInput, pickKey, savedIdeaTitles } from '../src/ai/pick';

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
      pick: {
        event,
        context: { lookingFor: 'Decorations — Balloons', accepted: [], declined: [], requests: [], profile: [], savedIdeas: [], partyIdeas: [], remainingBudget: 150 },
        candidates: [
          { id: 'a', name: 'A', colour: 'pink', style: 'cute', retailer: 'Party Lane', packLabel: '1', lineTotal: 5, vibes: ['cute'], whyRules: [] },
          { id: 'b', name: 'B', colour: 'gold', style: 'luxe', retailer: 'Glow & Co', packLabel: '1', lineTotal: 9, vibes: ['glam'], whyRules: [] },
        ],
      },
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

describe('AI product pick', () => {
  const richEvent = () => {
    let ev = { ...base(), type: 'birthday', name: 'Secret Name', venue: { mode: 'own', name: 'Secret Venue' } };
    const first = suggestNext(ev, 'decorations', 'balloons', ctx).suggestion;
    ev = applyDecline(ev, first, 'other', 'too loud', {
      reasons: ['colour'], avoidColours: [], preferColours: [], preferStyles: [], preferVibes: [], summary: 'Softer colours',
    });
    ev = applyRefinement(ev, 'more elegant', {
      preferVibes: ['elegant'], preferColours: [], avoidColours: [], preferStyles: [], avoidStyles: [], maxPrice: null, summary: 'More elegant',
    });
    return { ...ev, aiIdeas: [{ id: 'x', emoji: '🪩', title: 'Mini Disco Hour', text: 't', category: 'activities' }] };
  };

  test('input carries everything the app knows, never names or venues, and is valid', () => {
    const ev = richEvent();
    const ranked = rankCandidates(ev, 'decorations', 'balloons', ctx).list;
    const input = buildPickInput(ev, 'decorations', 'balloons', ranked, {
      profile: ['You’ve chosen gold for 3 events'],
      savedIdeas: savedIdeaTitles([{ kind: 'idea', refId: 'idea-galaxy' }, { kind: 'ai', refId: 'a', data: { title: 'Wish Jar' } }]),
    });
    expect(validateInput('pick', input)).toBe(true);
    expect(input.candidates.map((c) => c.id)).toEqual(ranked.slice(0, 6).map((s) => s.product.id));
    expect(input.context.declined[0]).toMatch(/Softer colours/);
    expect(input.context.requests).toEqual(['more elegant (More elegant)']);
    expect(input.context.profile).toEqual(['You’ve chosen gold for 3 events']);
    expect(input.context.savedIdeas).toEqual(['Galaxy Glow Night: Deep purples, star garlands, glow sticks and a cosmic playlist.', 'Wish Jar']);
    expect(input.context.partyIdeas).toEqual(['Mini Disco Hour']);
    expect(JSON.stringify(input)).not.toMatch(/Secret Name|Secret Venue/);
  });

  test('a pick must be one of the candidates, otherwise the rules pick stands', () => {
    const ev = base();
    const ranked = rankCandidates(ev, 'decorations', 'balloons', ctx).list;
    const input = buildPickInput(ev, 'decorations', 'balloons', ranked);
    const last = ranked[ranked.length - 1].product.id;
    expect(sanitizeOutput('pick', { choiceId: last, reason: 'Fits' }, input)).toEqual({ choiceId: last, reason: 'Fits' });
    expect(sanitizeOutput('pick', { choiceId: 'invented-product', reason: 'x' }, input)).toBeNull();

    const picked = applyPick(ranked, { choiceId: last, reason: 'It’s the elegant look you asked for' });
    expect(picked.product.id).toBe(last);
    expect(picked.aiPicked).toBe(true);
    expect(picked.reasons[0]).toBe('✨ It’s the elegant look you asked for');
    expect(applyPick(ranked, 'none')).toBe(ranked[0]);
    expect(applyPick(ranked, { choiceId: 'nope', reason: '' })).toBe(ranked[0]);
  });

  test('nothing to choose between → no AI call', () => {
    const ev = base();
    const ranked = rankCandidates(ev, 'decorations', 'balloons', ctx).list.slice(0, 1);
    expect(buildPickInput(ev, 'decorations', 'balloons', ranked)).toBeNull();
  });

  test('pick key changes when relevant information changes', () => {
    const ev = base();
    const ranked = rankCandidates(ev, 'decorations', 'balloons', ctx).list;
    const k1 = pickKey(ev, 'decorations', 'balloons', buildPickInput(ev, 'decorations', 'balloons', ranked));
    const ev2 = applyRefinement(ev, 'gold please', { preferVibes: [], preferColours: ['gold'], avoidColours: [], preferStyles: [], avoidStyles: [], maxPrice: null, summary: 'Gold' });
    const ranked2 = rankCandidates(ev2, 'decorations', 'balloons', ctx).list;
    const k2 = pickKey(ev2, 'decorations', 'balloons', buildPickInput(ev2, 'decorations', 'balloons', ranked2));
    expect(k1).not.toBe(k2);
    expect(pickKey(ev, 'decorations', 'balloons', buildPickInput(ev, 'decorations', 'balloons', ranked))).toBe(k1);
  });
});
