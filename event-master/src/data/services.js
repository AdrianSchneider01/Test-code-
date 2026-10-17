// KINDS OF HIRE SERVICE
//
// Hire services are local businesses, so Event Master doesn't list any by
// name. Each kind of service opens a real Google Maps search near the
// party's area (real businesses, with reviews), and the user shortlists the
// ones they like. Quotes, availability and bookings come only from the user.

export const SERVICE_TYPES = [
  {
    id: 'castle', emoji: '🏰', name: 'Jumping castle hire', category: 'activities', slot: 'activity', search: 'jumping castle hire',
    ask: ['Is setup, pack-down and delivery included in the quote?', 'How much flat space does it need, and does it need power?', 'What happens if it rains or is too windy?', 'Do you have public liability insurance?'],
  },
  {
    id: 'facepaint', emoji: '🎨', name: 'Face painter', category: 'activities', slot: 'activity', search: 'face painter for kids parties',
    ask: ['How many children can you paint per hour?', 'Are your paints skin-safe and suitable for sensitive skin?', 'Do you also do glitter tattoos or balloon twisting?'],
  },
  {
    id: 'entertainer', emoji: '🎩', name: 'Magician or kids entertainer', category: 'activities', slot: 'activity', search: 'kids party entertainer magician',
    ask: ['How long is the show, and what ages is it best for?', 'Do you have a Working With Children Check?', 'How much space and what setup do you need?'],
  },
  {
    id: 'games', emoji: '🎯', name: 'Giant lawn games hire', category: 'activities', slot: 'game', search: 'giant lawn games hire',
    ask: ['Which games are in the package?', 'Is delivery and pick-up included?', 'Are they suitable for the ages coming?'],
  },
  {
    id: 'dj', emoji: '🎧', name: 'DJ', category: 'music', slot: 'sound', search: 'party DJ',
    ask: ['Do you bring your own speakers, microphone and lights?', 'Can we send you a playlist and a do-not-play list?', 'How early do you arrive to set up, and are you insured?'],
  },
  {
    id: 'musician', emoji: '🎸', name: 'Live musician or band', category: 'music', slot: 'sound', search: 'live musician for parties',
    ask: ['How long do you play, and are breaks included?', 'Do you need power, and how much space?', 'Can you take song requests?'],
  },
  {
    id: 'pa', emoji: '🔊', name: 'Speaker / PA hire', category: 'music', slot: 'sound', search: 'PA speaker hire',
    ask: ['Is a microphone included?', 'Is delivery and setup included, or pick-up only?', 'What is the bond and the return time?'],
  },
  {
    id: 'photographer', emoji: '📷', name: 'Photographer', category: 'photography', slot: 'camera', search: 'event photographer',
    ask: ['How many hours are included, and how many edited photos?', 'How long until we get the photos, and how are they delivered?', 'Can we see a full gallery from a similar party?'],
  },
  {
    id: 'photobooth', emoji: '🤳', name: 'Photo booth hire', category: 'photography', slot: 'camera', search: 'photo booth hire',
    ask: ['Are unlimited prints and props included?', 'How much space and power does it need?', 'Is an attendant included for the whole time?'],
  },
  {
    id: 'balloons', emoji: '🎈', name: 'Balloon stylist', category: 'decorations', slot: 'balloons', search: 'balloon decorator',
    ask: ['Is delivery and installation included?', 'How long will the balloons last indoors and outdoors?', 'Can you match our colours?'],
  },
  {
    id: 'stylist', emoji: '🪩', name: 'Party stylist / backdrop hire', category: 'decorations', slot: 'backdrop', search: 'party backdrop hire',
    ask: ['What is included in the package?', 'Is setup and pack-down included?', 'Can we personalise the signage?'],
  },
  {
    id: 'partyhire', emoji: '🪑', name: 'Party hire (tables, chairs, marquees)', category: 'decorations', slot: 'table', search: 'party hire tables chairs marquee',
    ask: ['Is delivery, setup and collection included?', 'What is the bond and the damage policy?', 'Do you have rain cover or marquees?'],
  },
  {
    id: 'catering', emoji: '🍱', name: 'Caterer', category: 'food', slot: 'mains', search: 'party catering',
    ask: ['What is the price per person, and is there a minimum?', 'Can you cater for allergies and dietary needs?', 'Do you serve and clean up, or drop off only?'],
  },
  {
    id: 'drinksmachine', emoji: '🍧', name: 'Slushie or fairy floss machine hire', category: 'food', slot: 'drinks', search: 'slushie machine hire',
    ask: ['How many serves does it make, and are supplies included?', 'Does it need power?', 'Is delivery included?'],
  },
  {
    id: 'cakemaker', emoji: '🎂', name: 'Custom cake maker', category: 'cake', slot: 'cake', search: 'custom birthday cakes',
    ask: ['How far ahead do I need to order?', 'How many people will it serve?', 'Can you do allergy-friendly options, and is delivery available?'],
  },
  {
    id: 'lighting', emoji: '💡', name: 'Party lighting hire', category: 'extras', slot: 'lighting', search: 'party lighting hire',
    ask: ['Is setup included?', 'Does it need power, and how much?', 'Is it suitable outdoors?'],
  },
  {
    id: 'effects', emoji: '🫧', name: 'Bubble, snow or smoke machine hire', category: 'extras', slot: 'wow', search: 'bubble machine hire',
    ask: ['Is fluid included, and how long does it last?', 'Is it safe indoors at the venue?', 'Is delivery included?'],
  },
];

export const SERVICE_STATUSES = [
  { id: 'considering', emoji: '🤔', label: 'Considering' },
  { id: 'enquired', emoji: '✉️', label: 'Enquired' },
  { id: 'quoted', emoji: '💬', label: 'Quote received' },
  { id: 'booked', emoji: '📌', label: 'Booked' },
  { id: 'unavailable', emoji: '🚫', label: 'Not available' },
];

export function getServiceType(id) {
  return SERVICE_TYPES.find((t) => t.id === id) || null;
}

export function serviceTypesForSlot(categoryId, slotId) {
  return SERVICE_TYPES.filter((t) => t.category === categoryId && t.slot === slotId);
}

// Kinds of service for the party's chosen categories first, in category order.
export function rankServiceTypes(event) {
  const cats = event.categories || [];
  const order = (t) => (cats.includes(t.category) ? cats.indexOf(t.category) : 100);
  return SERVICE_TYPES.map((t, i) => ({ t, i }))
    .sort((a, b) => order(a.t) - order(b.t) || a.i - b.i)
    .map(({ t }) => ({ type: t, suggested: cats.includes(t.category) }));
}

// A Google Maps search for this kind of service near the area — real local
// businesses with their reviews, websites and phone numbers.
export function mapsSearchUrl(type, area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${type.search} near ${area}`)}`;
}
