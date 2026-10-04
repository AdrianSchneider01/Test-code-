// ── Input builders: only what the AI needs (no event names or venues) ──────
export function eventInfo(event) {
  return {
    type: event.type || null,
    typeOther: event.typeOther || '',
    otherVibe: event.otherVibe || '',
    vibes: (event.vibes || []).filter((v) => v !== 'other'),
    guests: event.guests,
    budget: event.budget ?? null,
    categories: event.categories || [],
  };
}

export function productFacts(suggestion) {
  const p = suggestion.product;
  return { name: p.name, colour: p.colour, style: p.style, retailer: p.retailer, lineTotal: suggestion.lineTotal };
}

// Text describing an event in the user's own words, if any.
export function ownWordsText(event) {
  const parts = [];
  if (event.type === 'other' && event.typeOther) parts.push(`Event: ${event.typeOther}`);
  if ((event.vibes || []).includes('other') && event.otherVibe) parts.push(`Vibe: ${event.otherVibe}`);
  return parts.join('. ');
}
