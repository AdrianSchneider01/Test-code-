// AI product picking.
//
// The rules engine first filters and ranks real catalogue products (declined
// items, avoided shops and "not that colour/style/price" constraints are
// already removed). The top few go to Claude together with everything the app
// knows about the party and the user, and Claude chooses the best fit. Its
// answer must be one of those candidate ids, so it can never invent a product.

import { getCategory, getSlot } from '../data/categories';
import { getProduct } from '../data/catalog';
import { getIdea } from '../data/ideas';
import { DECLINE_REASONS, budgetSummary } from '../logic/engine';
import { eventInfo } from './inputs';

export const PICK_CANDIDATES = 6;

const clip = (s, max = 280) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function savedIdeaTitles(savedIdeas) {
  return savedIdeas
    .map((s) => {
      if (s.kind === 'product') {
        const p = getProduct(s.refId);
        return p ? `${p.name} (${p.colour}, ${p.style})` : null;
      }
      if (s.kind === 'ai') return s.data ? s.data.title : null;
      const idea = getIdea(s.refId);
      return idea ? `${idea.title}: ${idea.text}` : null;
    })
    .filter(Boolean)
    .slice(-15)
    .map((t) => clip(t));
}

function declineLine(d) {
  const reason = DECLINE_REASONS.find((r) => r.id === d.reason);
  let line = `${d.snapshot.name} (${d.snapshot.colour}, ${d.snapshot.style}): ${reason ? reason.label : d.reason}`;
  if (d.ai && d.ai.summary) line += ` — ${d.ai.summary}`;
  else if (d.note) line += ` — "${d.note}"`;
  return clip(line);
}

// Builds the "pick" request, or null when there's nothing to choose between.
// `profile` is the list of memory texts, passed only when the user opted in.
export function buildPickInput(event, categoryId, slotId, ranked, { profile = [], savedIdeas = [] } = {}) {
  const candidates = ranked.slice(0, PICK_CANDIDATES);
  if (candidates.length < 2) return null;
  const cat = getCategory(categoryId);
  const slot = getSlot(categoryId, slotId);
  const { remaining } = budgetSummary(event);
  return {
    event: eventInfo(event),
    context: {
      lookingFor: `${cat.name} — ${slot ? slot.name : slotId}`,
      accepted: event.items.slice(-30).map((i) => clip([i.name, i.colour, i.style].filter(Boolean).join(' · '))),
      declined: event.declines.slice(-30).map(declineLine),
      requests: (event.refinements || []).slice(-15).map((r) => clip(r.summary ? `${r.text} (${r.summary})` : r.text)),
      vibeUnderstanding: event.vibeHints && event.vibeHints.summary ? clip(event.vibeHints.summary, 200) : '',
      profile: profile.slice(0, 30).map((t) => clip(t)),
      savedIdeas,
      partyIdeas: (event.aiIdeas || []).slice(0, 10).map((i) => clip(i.title)),
      remainingBudget: remaining,
    },
    candidates: candidates.map((s) => ({
      id: s.product.id,
      name: s.product.name,
      colour: s.product.colour,
      style: s.product.style,
      retailer: s.product.retailer,
      packLabel: s.product.packLabel,
      lineTotal: s.lineTotal,
      vibes: s.product.vibes,
      whyRules: s.reasons,
    })),
  };
}

// Identifies the information a pick was based on, so it's re-asked only when
// something relevant changes (and cached otherwise).
export function pickKey(event, categoryId, slotId, input) {
  if (!input) return null;
  return [
    event.id,
    `${categoryId}/${slotId}`,
    input.candidates.map((c) => c.id).join(','),
    `i${event.items.length}`,
    `d${event.declines.length}`,
    `r${(event.refinements || []).map((r) => r.id).join('.')}`,
    `p${input.context.profile.length}`,
    `s${input.context.savedIdeas.length}`,
    `g${event.guests}`,
    `b${event.budget}`,
    `v${(event.vibes || []).join('.')}`,
    event.vibeHints ? event.vibeHints.summary : '',
  ].join('|');
}

// Applies Claude's choice to the ranked list. Falls back to the rules' top
// pick when there's no valid answer.
export function applyPick(ranked, pick) {
  if (!ranked.length) return null;
  if (!pick || typeof pick !== 'object') return ranked[0];
  const chosen = ranked.find((s) => s.product.id === pick.choiceId);
  if (!chosen) return ranked[0];
  const reasons = pick.reason ? [`✨ ${pick.reason}`, ...chosen.reasons] : chosen.reasons;
  return { ...chosen, reasons: reasons.slice(0, 3), aiPicked: true };
}
