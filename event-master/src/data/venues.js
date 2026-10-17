// Kinds of venue (not specific places). Event Master never claims a real
// venue is available: the user adds real venues to a shortlist and records
// what each one has confirmed.

export const VENUE_TYPES = [
  {
    id: 'home', emoji: '🏡', name: 'Home or backyard', setting: 'both', capacity: [1, 40], cost: 'Free',
    vibes: ['relaxed', 'cute', 'fun', 'party'], types: ['birthday', 'sleepover', 'holiday', 'celebration'],
    good: 'Free, flexible timing and no packing up against the clock.', watch: 'Space, parking, neighbours and wet-weather backup.',
    ask: ['Is there a rain plan (gazebo or indoor space)?', 'Will noise be OK for the neighbours?', 'Where will guests park?'],
  },
  {
    id: 'park', emoji: '🌳', name: 'Park or picnic area', setting: 'outdoor', capacity: [5, 80], cost: 'Free to low',
    vibes: ['relaxed', 'fun', 'colourful'], types: ['birthday', 'celebration', 'graduation'],
    good: 'Plenty of room to run around and a relaxed feel.', watch: 'Weather, shade, toilets and whether spots can be booked.',
    ask: ['Can the picnic area or shelter be booked?', 'Are there toilets, BBQs and shade nearby?', 'Are decorations, music or bouncy castles allowed?'],
  },
  {
    id: 'hall', emoji: '🏛️', name: 'Community hall', setting: 'indoor', capacity: [20, 150], cost: 'Low',
    vibes: ['party', 'fun', 'themed', 'colourful'], types: ['birthday', 'celebration', 'graduation', 'holiday'],
    good: 'Affordable indoor space you can decorate your way.', watch: 'Set-up and pack-down times, and the kitchen facilities.',
    ask: ['What are the hire hours, including set-up and pack-down?', 'Is there a kitchen, fridge and tables/chairs?', 'Is there a bond, and what are the cleaning rules?'],
  },
  {
    id: 'restaurant', emoji: '🍽️', name: 'Restaurant or café private area', setting: 'indoor', capacity: [8, 60], cost: 'Medium',
    vibes: ['elegant', 'relaxed', 'glam'], types: ['birthday', 'celebration', 'graduation', 'holiday'],
    good: 'Food and clean-up handled for you.', watch: 'Minimum spends, set menus and how much you can decorate.',
    ask: ['Is there a minimum spend or room hire fee?', 'Can we bring our own cake (and is there a cakeage fee)?', 'Can we decorate the space?'],
  },
  {
    id: 'activity', emoji: '🎳', name: 'Activity centre (bowling, laser tag, trampolines)', setting: 'indoor', capacity: [6, 40], cost: 'Medium',
    vibes: ['fun', 'party', 'themed'], types: ['birthday', 'celebration'],
    good: 'Entertainment built in, so less planning.', watch: 'Fixed time slots, per-head pricing and age limits.',
    ask: ['What is included per guest (food, drinks, party room)?', 'How long is the session and the party room?', 'Are there age or height limits?'],
  },
  {
    id: 'function', emoji: '🥂', name: 'Function room or venue hire', setting: 'indoor', capacity: [30, 300], cost: 'High',
    vibes: ['elegant', 'glam', 'party'], types: ['celebration', 'graduation', 'holiday', 'birthday'],
    good: 'Polished space, often with catering, staff and AV.', watch: 'Packages, deposits and cancellation terms.',
    ask: ['What packages are there and what is included?', 'What is the deposit and cancellation policy?', 'Is there AV, a dance floor and a styling allowance?'],
  },
  {
    id: 'studio', emoji: '🎨', name: 'Craft, art or dance studio', setting: 'indoor', capacity: [6, 30], cost: 'Medium',
    vibes: ['cute', 'relaxed', 'themed', 'fun'], types: ['birthday', 'sleepover', 'celebration'],
    good: 'A hosted activity everyone joins in on.', watch: 'Group size limits and what guests take home.',
    ask: ['Is a host or instructor included?', 'What does each guest make or take home?', 'Can we bring food and a cake?'],
  },
  {
    id: 'beach', emoji: '🏖️', name: 'Beach or waterfront', setting: 'outdoor', capacity: [5, 60], cost: 'Free',
    vibes: ['relaxed', 'fun', 'themed'], types: ['birthday', 'celebration', 'holiday'],
    good: 'A memorable setting with built-in activities.', watch: 'Weather, tides, sun protection and local rules.',
    ask: ['Are gatherings or permits required at this beach?', 'Is there shade, shelter and toilets?', 'What is the plan if it rains or is windy?'],
  },
  {
    id: 'pool', emoji: '🏊', name: 'Pool or aquatic centre party room', setting: 'both', capacity: [8, 40], cost: 'Medium',
    vibes: ['fun', 'party'], types: ['birthday', 'celebration'],
    good: 'Swimming plus a room for food and cake.', watch: 'Supervision ratios, swim ability and time slots.',
    ask: ['What are the supervision rules for kids?', 'Is a lifeguard or party host included?', 'How long do we have the party room?'],
  },
  {
    id: 'cinema', emoji: '🎬', name: 'Cinema private screening', setting: 'indoor', capacity: [10, 100], cost: 'Medium to high',
    vibes: ['themed', 'fun', 'relaxed'], types: ['birthday', 'celebration', 'sleepover'],
    good: 'A special treat that needs little set-up.', watch: 'Film choice, session times and food rules.',
    ask: ['Can we choose the film?', 'Are snacks and drinks included?', 'Is there a space for cake beforehand?'],
  },
];

export const VENUE_STATUSES = [
  { id: 'considering', label: 'Considering', emoji: '🤔' },
  { id: 'enquired', label: 'Enquired', emoji: '✉️' },
  { id: 'available', label: 'Confirmed available', emoji: '✅' },
  { id: 'booked', label: 'Booked', emoji: '📌' },
  { id: 'unavailable', label: 'Not available', emoji: '✖️' },
];

export function getVenueType(id) {
  return VENUE_TYPES.find((v) => v.id === id) || null;
}

// How well a kind of venue matches the party (by the rules; AI can refine).
export function rankVenueTypes(event) {
  const guests = event.guests || 1;
  const vibes = event.vibes || [];
  return VENUE_TYPES.map((v) => {
    const reasons = [];
    let score = 0;
    if (guests >= v.capacity[0] && guests <= v.capacity[1]) {
      score += 3;
      reasons.push(`Suits around ${guests} guests`);
    } else {
      score -= 4;
    }
    const matched = v.vibes.filter((x) => vibes.includes(x));
    score += 2 * matched.length;
    if (matched.length) reasons.push(`Fits a ${matched.slice(0, 2).join(' + ')} vibe`);
    if (v.types.includes(event.type)) score += 2;
    if (event.budget != null && event.budget < 200 && /High/.test(v.cost)) score -= 3;
    if (event.budget != null && event.budget < 200 && /Free/.test(v.cost)) {
      score += 1;
      reasons.push('Easy on the budget');
    }
    return { type: v, score, reasons, fits: guests >= v.capacity[0] && guests <= v.capacity[1] };
  }).sort((a, b) => b.score - a.score);
}
