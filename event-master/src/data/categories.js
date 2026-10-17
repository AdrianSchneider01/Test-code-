// Planning categories ("aspects"). Each category is split into slots: the
// individual things Event Master resolves one suggestion at a time. A category
// is complete only when every slot has been resolved (accepted, own item, or
// skipped) — accepting one item never completes a whole category.
export const CATEGORIES = [
  {
    id: 'decorations',
    emoji: '🎀',
    name: 'Decorations',
    blurb: 'Balloons, banners, table settings and a backdrop that tie the look together.',
    slots: [
      { id: 'balloons', name: 'Balloons' },
      { id: 'banner', name: 'Banner or garland' },
      { id: 'table', name: 'Table setting' },
      { id: 'backdrop', name: 'Backdrop' },
    ],
  },
  {
    id: 'food',
    emoji: '🍕',
    name: 'Food & drinks',
    blurb: 'Mains, snacks and drinks sized to your guest list.',
    slots: [
      { id: 'mains', name: 'Main food' },
      { id: 'snacks', name: 'Snacks' },
      { id: 'drinks', name: 'Drinks' },
    ],
  },
  {
    id: 'cake',
    emoji: '🎂',
    name: 'Cake',
    blurb: 'A cake or cupcakes that match your vibe, plus candles.',
    slots: [
      { id: 'cake', name: 'Cake or cupcakes' },
      { id: 'candles', name: 'Candles & topper' },
    ],
  },
  {
    id: 'activities',
    emoji: '🎮',
    name: 'Activities & games',
    blurb: 'A headline activity and a game to keep everyone involved.',
    slots: [
      { id: 'activity', name: 'Main activity' },
      { id: 'game', name: 'Party game' },
    ],
  },
  {
    id: 'invitations',
    emoji: '💌',
    name: 'Invitations',
    blurb: 'Invitations that set the tone before the party starts.',
    slots: [{ id: 'invites', name: 'Invitations' }],
  },
  {
    id: 'favours',
    emoji: '🎁',
    name: 'Party bags & favours',
    blurb: 'Bags and fillers so every guest leaves with something.',
    slots: [
      { id: 'bags', name: 'Party bags' },
      { id: 'fillers', name: 'Bag fillers' },
    ],
  },
  {
    id: 'music',
    emoji: '🎵',
    name: 'Music',
    blurb: 'Sound and a soundtrack for the party.',
    slots: [
      { id: 'sound', name: 'Speaker / sound' },
      { id: 'playlist', name: 'Playlist' },
    ],
  },
  {
    id: 'photography',
    emoji: '📸',
    name: 'Photography',
    blurb: 'Photo props and a way to capture the night.',
    slots: [
      { id: 'props', name: 'Photo props' },
      { id: 'camera', name: 'Camera & prints' },
    ],
  },
  {
    id: 'extras',
    emoji: '✨',
    name: 'Extra touches',
    blurb: 'Lighting and little wow-moments that make it feel special.',
    slots: [
      { id: 'lighting', name: 'Lighting' },
      { id: 'wow', name: 'Wow moment' },
    ],
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

// Pre-selected when a new party is created ("Selected: 6 aspects").
export const DEFAULT_CATEGORY_IDS = ['decorations', 'food', 'cake', 'activities', 'invitations', 'favours'];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

export function getSlot(categoryId, slotId) {
  const cat = getCategory(categoryId);
  return cat ? cat.slots.find((s) => s.id === slotId) || null : null;
}

export const EVENT_TYPES = [
  { id: 'birthday', emoji: '🎂', label: 'Birthday' },
  { id: 'celebration', emoji: '🥳', label: 'Celebration' },
  { id: 'graduation', emoji: '🎓', label: 'Graduation' },
  { id: 'sleepover', emoji: '👯', label: 'Sleepover' },
  { id: 'holiday', emoji: '🎄', label: 'Holiday party' },
  { id: 'other', emoji: '✨', label: 'Something else' },
];

export function eventTypeOf(event) {
  return EVENT_TYPES.find((t) => t.id === event.type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

export const VIBES = [
  { id: 'elegant', emoji: '✨', label: 'Elegant' },
  { id: 'cute', emoji: '🎀', label: 'Cute' },
  { id: 'colourful', emoji: '🌈', label: 'Colourful' },
  { id: 'fun', emoji: '🎉', label: 'Fun' },
  { id: 'glam', emoji: '💎', label: 'Glam' },
  { id: 'relaxed', emoji: '🌿', label: 'Relaxed' },
  { id: 'themed', emoji: '🎪', label: 'Themed' },
  { id: 'party', emoji: '🪩', label: 'Party' },
  { id: 'other', emoji: '✏️', label: 'Other' },
];

export function vibeLabel(id) {
  const v = VIBES.find((x) => x.id === id);
  return v ? v.label : id;
}

export const COLOURS = ['pink', 'purple', 'gold', 'silver', 'white', 'blue', 'green', 'rainbow', 'black', 'natural'];

export const COLOUR_SWATCH = {
  pink: '#FF5FAE',
  purple: '#9B6BFF',
  gold: '#E8B931',
  silver: '#C3C8D9',
  white: '#F2F2F7',
  blue: '#4D8DFF',
  green: '#3CCB8A',
  rainbow: '#FF8A3D',
  black: '#2A2A35',
  natural: '#C9A27C',
};

export const STYLES = ['modern', 'classic', 'minimal', 'cute', 'luxe', 'boho', 'retro'];

export function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
