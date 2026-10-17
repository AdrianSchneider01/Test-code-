// Input builders for AI tasks that review a whole plan. No event names or
// venues are ever included.

import { getCategory } from '../data/categories';
import { DECLINE_REASONS, budgetSummary, itemTotal } from '../logic/engine';
import { eventInfo } from './inputs';

const clip = (s, max = 280) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function declineLine(d) {
  const reason = DECLINE_REASONS.find((r) => r.id === d.reason);
  let line = `${d.snapshot.name} (${d.snapshot.colour}, ${d.snapshot.style}, ${d.snapshot.retailer}): ${reason ? reason.label : d.reason}`;
  if (d.ai && d.ai.summary) line += ` — ${d.ai.summary}`;
  else if (d.note) line += ` — "${d.note}"`;
  return clip(line);
}

// "learn": what a saved party says about the person's taste.
export function buildLearnInput(event) {
  return {
    event: eventInfo(event),
    accepted: event.items
      .filter((i) => !i.custom)
      .slice(0, 40)
      .map((i) => clip([i.name, i.colour, i.style, i.retailer].filter(Boolean).join(' · '))),
    declined: event.declines.slice(-40).map(declineLine),
    requests: (event.refinements || []).slice(-15).map((r) => clip(r.summary ? `${r.text} (${r.summary})` : r.text)),
    ownItems: event.items
      .filter((i) => i.custom)
      .slice(0, 20)
      .map((i) => clip(i.notes ? `${i.name} — ${i.notes}` : i.name)),
    vibeUnderstanding: event.vibeHints && event.vibeHints.summary ? clip(event.vibeHints.summary, 200) : '',
  };
}

// "budgetHelp": the plan's items with their costs, biggest first.
export function buildBudgetHelpInput(event) {
  const b = budgetSummary(event);
  if (!b.over || !event.items.length) return null;
  return {
    event: eventInfo(event),
    budget: b.budget,
    total: b.total,
    overBy: -b.remaining,
    items: [...event.items]
      .sort((x, y) => itemTotal(y) - itemTotal(x))
      .slice(0, 40)
      .map((i) => ({ id: i.id, name: clip(i.name, 120), category: getCategory(i.category).name, lineTotal: itemTotal(i), qty: i.qty })),
  };
}
