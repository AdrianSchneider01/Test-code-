// SAMPLE PRODUCT CATALOGUE
//
// These are placeholder products so the full planning experience works end to
// end. Shop names are fictional and prices are illustrative. `url` is null on
// purpose: real product links, images and prices arrive in Build Phase 4 and
// must come from a reliable structured source — never invented.
//
// qty rule:
//   { type: 'fixed', n }        → always n units
//   { type: 'perGuest', per }   → one unit for every `per` guests (rounded up)

export const SHOPS = ['Party Lane', 'Glow & Co', 'Craft Loft', 'Budget Bash', 'Sweet Street', 'Snap Studio'];

function p(id, category, slot, name, emoji, colour, style, vibes, retailer, price, packLabel, packSize, qty, description, subtype) {
  return { id, category, slot, name, emoji, colour, style, vibes, retailer, price, packLabel, packSize, qty, description, subtype: subtype || null, url: null, sample: true };
}

const fixed = (n) => ({ type: 'fixed', n });
const perGuest = (per) => ({ type: 'perGuest', per });

export const CATALOG = [
  // ── Decorations ─────────────────────────────────────────────
  p('bal-pink-20', 'decorations', 'balloons', 'Pink Balloon Set', '🎈', 'pink', 'cute', ['cute', 'fun', 'party', 'colourful'], 'Party Lane', 5, '20 balloons', 20, perGuest(10), 'Matte pastel-pink latex balloons.'),
  p('bal-purple-chrome', 'decorations', 'balloons', 'Purple Chrome Balloons', '🎈', 'purple', 'luxe', ['glam', 'party', 'elegant'], 'Glow & Co', 12, '15 balloons', 15, perGuest(10), 'High-shine chrome finish for a glam look.'),
  p('bal-gold-confetti', 'decorations', 'balloons', 'Gold Confetti Balloons', '🎈', 'gold', 'classic', ['elegant', 'glam'], 'Party Lane', 9, '10 balloons', 10, perGuest(8), 'Clear balloons filled with gold foil confetti.'),
  p('bal-rainbow-50', 'decorations', 'balloons', 'Rainbow Balloon Mega Pack', '🎈', 'rainbow', 'retro', ['colourful', 'fun', 'party'], 'Budget Bash', 7, '50 balloons', 50, fixed(1), 'Fifty balloons in bright mixed colours.'),
  p('bal-white-arch', 'decorations', 'balloons', 'White & Silver Balloon Arch Kit', '🎈', 'silver', 'modern', ['elegant', 'relaxed'], 'Glow & Co', 28, '1 arch kit', 1, fixed(1), 'Arch kit with tape strip and 90 balloons.'),

  p('ban-purple-stars', 'decorations', 'banner', 'Purple Star Garland', '⭐', 'purple', 'modern', ['cute', 'party', 'themed'], 'Craft Loft', 8, '3 m garland', 3, fixed(1), 'Felt star garland in two shades of purple.'),
  p('ban-gold-letters', 'decorations', 'banner', 'Gold Letter Banner', '🪧', 'gold', 'classic', ['elegant', 'glam'], 'Party Lane', 11, '1 banner', 1, fixed(1), 'Customisable foil letter banner.'),
  p('ban-pastel-bunting', 'decorations', 'banner', 'Pastel Bunting', '🎏', 'pink', 'cute', ['cute', 'relaxed', 'colourful'], 'Budget Bash', 4, '5 m bunting', 5, fixed(1), 'Soft pastel paper bunting.'),
  p('ban-neon-sign', 'decorations', 'banner', 'Neon "Let\'s Party" Sign', '💡', 'pink', 'retro', ['party', 'fun', 'glam'], 'Glow & Co', 34, '1 sign', 1, fixed(1), 'USB-powered LED neon sign.'),

  p('tab-pink-set', 'decorations', 'table', 'Pink Plates & Cups Set', '🍽️', 'pink', 'cute', ['cute', 'fun', 'colourful'], 'Party Lane', 6, 'serves 8', 8, perGuest(8), 'Paper plates, cups and napkins for 8.'),
  p('tab-gold-rim', 'decorations', 'table', 'Gold-Rim Tableware Set', '🍽️', 'gold', 'luxe', ['elegant', 'glam'], 'Glow & Co', 14, 'serves 10', 10, perGuest(10), 'White plates with a metallic gold rim.'),
  p('tab-white-minimal', 'decorations', 'table', 'Minimal White Tableware', '🍽️', 'white', 'minimal', ['relaxed', 'elegant'], 'Budget Bash', 4, 'serves 12', 12, perGuest(12), 'Compostable plain white tableware.'),
  p('tab-purple-galaxy', 'decorations', 'table', 'Galaxy Purple Tableware', '🍽️', 'purple', 'modern', ['themed', 'party', 'fun'], 'Craft Loft', 9, 'serves 8', 8, perGuest(8), 'Deep purple tableware with a star print.'),

  p('bd-sequin-pink', 'decorations', 'backdrop', 'Pink Sequin Backdrop', '🪩', 'pink', 'luxe', ['glam', 'party'], 'Glow & Co', 24, '2 × 2 m', 2, fixed(1), 'Shimmer sequin wall for photos.'),
  p('bd-fairy-curtain', 'decorations', 'backdrop', 'Fairy-Light Curtain', '✨', 'white', 'classic', ['elegant', 'relaxed'], 'Party Lane', 19, '3 × 2 m', 3, fixed(1), 'Warm white light curtain.'),
  p('bd-foil-purple', 'decorations', 'backdrop', 'Purple Foil Fringe Curtain', '🎊', 'purple', 'retro', ['party', 'fun', 'colourful'], 'Budget Bash', 6, '2 curtains', 2, fixed(1), 'Two metallic fringe curtains.'),
  p('bd-greenery', 'decorations', 'backdrop', 'Faux Greenery Wall', '🌿', 'green', 'boho', ['relaxed', 'elegant'], 'Craft Loft', 29, '1 panel set', 1, fixed(1), 'Faux foliage panels, reusable.'),

  // ── Food & drinks ───────────────────────────────────────────
  p('food-pizza', 'food', 'mains', 'Party Pizza Platter', '🍕', 'natural', 'classic', ['fun', 'relaxed', 'party'], 'Sweet Street', 22, 'serves 6', 6, perGuest(6), 'Three large pizzas, mixed toppings.'),
  p('food-sliders', 'food', 'mains', 'Mini Slider Platter', '🍔', 'natural', 'modern', ['party', 'fun'], 'Sweet Street', 30, '12 sliders', 12, perGuest(6), 'Twelve mini burgers.'),
  p('food-grazing', 'food', 'mains', 'Grazing Board', '🧀', 'natural', 'luxe', ['elegant', 'relaxed', 'glam'], 'Glow & Co', 45, 'serves 10', 10, perGuest(10), 'Cheese, fruit, crackers and dips.'),
  p('food-sandwiches', 'food', 'mains', 'Sandwich Platter', '🥪', 'natural', 'classic', ['relaxed', 'cute'], 'Budget Bash', 18, 'serves 8', 8, perGuest(8), 'Mixed sandwich points.'),

  p('snk-popcorn', 'food', 'snacks', 'Popcorn Bar Kit', '🍿', 'white', 'retro', ['fun', 'party', 'themed'], 'Party Lane', 12, 'serves 10', 10, perGuest(10), 'Popcorn with sweet and salty toppings.'),
  p('snk-fruit-cups', 'food', 'snacks', 'Fruit Cups', '🍓', 'pink', 'cute', ['cute', 'relaxed', 'colourful'], 'Sweet Street', 2, '1 cup', 1, perGuest(1), 'Individual fresh fruit cups.'),
  p('snk-chips', 'food', 'snacks', 'Chips & Dips Pack', '🥨', 'natural', 'classic', ['fun', 'relaxed'], 'Budget Bash', 9, 'serves 12', 12, perGuest(12), 'Crisps, pretzels and two dips.'),
  p('snk-macarons', 'food', 'snacks', 'Pastel Macarons', '🍬', 'pink', 'luxe', ['elegant', 'cute', 'glam'], 'Sweet Street', 16, '12 macarons', 12, perGuest(12), 'Assorted pastel macarons.'),

  p('drk-lemonade', 'food', 'drinks', 'Pink Lemonade Jug', '🍹', 'pink', 'cute', ['cute', 'fun', 'colourful'], 'Sweet Street', 6, 'serves 6', 6, perGuest(6), 'Freshly made pink lemonade.'),
  p('drk-mocktail', 'food', 'drinks', 'Sparkling Mocktail Kit', '🥂', 'purple', 'luxe', ['elegant', 'glam', 'party'], 'Glow & Co', 18, 'serves 10', 10, perGuest(10), 'Sparkling juice, syrups and garnishes.'),
  p('drk-juice-boxes', 'food', 'drinks', 'Juice Box Pack', '🧃', 'rainbow', 'classic', ['fun', 'relaxed'], 'Budget Bash', 5, '10 boxes', 10, perGuest(10), 'Assorted fruit juice boxes.'),
  p('drk-water-bar', 'food', 'drinks', 'Infused Water Station', '🫗', 'white', 'minimal', ['relaxed', 'elegant'], 'Craft Loft', 8, 'serves 15', 15, perGuest(15), 'Dispenser with fruit and herb infusions.'),

  // ── Cake ────────────────────────────────────────────────────
  p('cake-drip-choc', 'cake', 'cake', 'Chocolate Drip Cake', '🎂', 'natural', 'modern', ['fun', 'party', 'glam'], 'Sweet Street', 55, 'serves 15', 15, perGuest(15), 'Two-layer chocolate cake with ganache drip.', 'cake'),
  p('cake-pink-tier', 'cake', 'cake', 'Pink Ombre Layer Cake', '🎂', 'pink', 'cute', ['cute', 'elegant', 'colourful'], 'Sweet Street', 65, 'serves 20', 20, perGuest(20), 'Vanilla sponge with pink ombre buttercream.', 'cake'),
  p('cake-galaxy-cupcakes', 'cake', 'cake', 'Galaxy Cupcakes', '🧁', 'purple', 'modern', ['themed', 'fun', 'party'], 'Sweet Street', 3, '1 cupcake', 1, perGuest(1), 'Purple swirl cupcakes with edible glitter.', 'cupcakes'),
  p('cake-gold-cupcakes', 'cake', 'cake', 'Gold Leaf Cupcakes', '🧁', 'gold', 'luxe', ['elegant', 'glam'], 'Glow & Co', 4, '1 cupcake', 1, perGuest(1), 'Vanilla cupcakes with gold leaf.', 'cupcakes'),
  p('cake-rainbow-sheet', 'cake', 'cake', 'Rainbow Sprinkle Sheet Cake', '🍰', 'rainbow', 'retro', ['colourful', 'fun'], 'Budget Bash', 35, 'serves 24', 24, perGuest(24), 'Funfetti sheet cake.', 'cake'),

  p('cnd-gold-number', 'cake', 'candles', 'Gold Number Candles', '🕯️', 'gold', 'classic', ['elegant', 'glam'], 'Party Lane', 6, '2 candles', 2, fixed(1), 'Glitter gold number candles.'),
  p('cnd-pink-sparkler', 'cake', 'candles', 'Pink Sparkler Candles', '🎇', 'pink', 'cute', ['cute', 'party', 'fun'], 'Party Lane', 5, '6 candles', 6, fixed(1), 'Indoor-safe sparkler candles.'),
  p('cnd-acrylic-topper', 'cake', 'candles', 'Acrylic Name Topper', '🔤', 'purple', 'modern', ['elegant', 'themed'], 'Craft Loft', 15, '1 topper', 1, fixed(1), 'Personalised mirror-acrylic topper.'),
  p('cnd-rainbow-pack', 'cake', 'candles', 'Rainbow Candle Pack', '🕯️', 'rainbow', 'retro', ['colourful', 'fun'], 'Budget Bash', 2, '24 candles', 24, fixed(1), 'Classic striped candles.'),

  // ── Activities & games ─────────────────────────────────────
  p('act-karaoke', 'activities', 'activity', 'Karaoke Machine Hire', '🎤', 'black', 'modern', ['party', 'fun', 'glam'], 'Snap Studio', 45, '1 day hire', 1, fixed(1), 'Speaker, two mics and a lyrics screen.'),
  p('act-bracelet-bar', 'activities', 'activity', 'DIY Bracelet Bar', '📿', 'pink', 'cute', ['cute', 'relaxed', 'colourful'], 'Craft Loft', 3, 'per guest', 1, perGuest(1), 'Beads, charms and elastic for each guest.'),
  p('act-cookie-decorating', 'activities', 'activity', 'Cookie Decorating Kit', '🍪', 'pink', 'cute', ['cute', 'fun'], 'Sweet Street', 4, 'per guest', 1, perGuest(1), 'Two cookies plus icing and sprinkles each.'),
  p('act-glow-dance', 'activities', 'activity', 'Glow Dance Party Pack', '🪩', 'purple', 'retro', ['party', 'fun', 'themed'], 'Glow & Co', 25, 'up to 15 guests', 15, perGuest(15), 'Glow sticks, disco light and playlist cards.'),
  p('act-spa', 'activities', 'activity', 'Mini Spa Kit', '💅', 'white', 'luxe', ['relaxed', 'elegant', 'glam'], 'Glow & Co', 6, 'per guest', 1, perGuest(1), 'Face masks, nail polish and headbands.'),

  p('gm-scavenger', 'activities', 'game', 'Printable Scavenger Hunt', '🔎', 'natural', 'classic', ['fun', 'themed'], 'Craft Loft', 6, '1 printable', 1, fixed(1), 'Clue cards you print at home.'),
  p('gm-trivia', 'activities', 'game', 'Party Trivia Cards', '❓', 'purple', 'modern', ['fun', 'party'], 'Party Lane', 10, '100 cards', 100, fixed(1), 'Trivia for mixed ages.'),
  p('gm-pinata', 'activities', 'game', 'Star Piñata', '⭐', 'gold', 'retro', ['fun', 'colourful', 'party'], 'Budget Bash', 15, '1 piñata', 1, fixed(1), 'Pull-string star piñata.'),
  p('gm-murder-mystery', 'activities', 'game', 'Mystery Party Game', '🕵️', 'black', 'classic', ['themed', 'elegant'], 'Snap Studio', 20, 'up to 12 players', 12, perGuest(12), 'Character booklets and clues.'),

  // ── Invitations ────────────────────────────────────────────
  p('inv-digital-glam', 'invitations', 'invites', 'Digital Glam Invitation', '📱', 'purple', 'modern', ['glam', 'party', 'elegant'], 'Snap Studio', 8, 'unlimited sends', 1, fixed(1), 'Animated invite with RSVP link.'),
  p('inv-printed-pink', 'invitations', 'invites', 'Printed Pink Invitations', '💌', 'pink', 'cute', ['cute', 'colourful'], 'Craft Loft', 1.5, '1 card', 1, perGuest(1), 'Printed cards with envelopes.'),
  p('inv-gold-foil', 'invitations', 'invites', 'Gold Foil Invitations', '✉️', 'gold', 'luxe', ['elegant', 'glam'], 'Glow & Co', 3, '1 card', 1, perGuest(1), 'Heavy card with gold foil print.'),
  p('inv-printable', 'invitations', 'invites', 'Printable Invitation Template', '🖨️', 'rainbow', 'retro', ['fun', 'relaxed', 'colourful'], 'Budget Bash', 4, '1 template', 1, fixed(1), 'Edit and print as many as you need.'),

  // ── Party bags & favours ───────────────────────────────────
  p('bag-pink-paper', 'favours', 'bags', 'Pink Paper Party Bags', '🛍️', 'pink', 'cute', ['cute', 'colourful'], 'Party Lane', 4, '10 bags', 10, perGuest(10), 'Striped paper bags with stickers.'),
  p('bag-holo', 'favours', 'bags', 'Holographic Party Bags', '👜', 'purple', 'modern', ['glam', 'party', 'fun'], 'Glow & Co', 9, '8 bags', 8, perGuest(8), 'Iridescent zip pouches.'),
  p('bag-kraft', 'favours', 'bags', 'Kraft Tote Bags', '🧺', 'natural', 'boho', ['relaxed', 'elegant'], 'Craft Loft', 12, '10 totes', 10, perGuest(10), 'Reusable mini canvas totes.'),
  p('bag-budget', 'favours', 'bags', 'Bright Plastic Bags', '🎒', 'rainbow', 'classic', ['fun', 'colourful'], 'Budget Bash', 2, '20 bags', 20, perGuest(20), 'Mixed bright loot bags.'),

  p('fil-lipgloss', 'favours', 'fillers', 'Mini Lip Gloss', '💄', 'pink', 'cute', ['cute', 'glam'], 'Glow & Co', 2, '1 gloss', 1, perGuest(1), 'Fruit-flavoured mini glosses.'),
  p('fil-glow', 'favours', 'fillers', 'Glow Stick Bundle', '🌟', 'rainbow', 'retro', ['party', 'fun'], 'Budget Bash', 5, '50 sticks', 50, perGuest(10), 'Bracelets and connectors.'),
  p('fil-candy', 'favours', 'fillers', 'Pick & Mix Candy', '🍭', 'rainbow', 'classic', ['fun', 'colourful'], 'Sweet Street', 3, '1 bag', 1, perGuest(1), 'Assorted sweets per bag.'),
  p('fil-scrunchie', 'favours', 'fillers', 'Satin Scrunchies', '🎀', 'purple', 'luxe', ['elegant', 'cute'], 'Craft Loft', 6, '5 scrunchies', 5, perGuest(5), 'Soft satin scrunchies in purple tones.'),

  // ── Music ──────────────────────────────────────────────────
  p('mus-speaker-hire', 'music', 'sound', 'Party Speaker Hire', '🔊', 'black', 'modern', ['party', 'fun'], 'Snap Studio', 35, '1 day hire', 1, fixed(1), 'Bluetooth speaker with light show.'),
  p('mus-mini-speaker', 'music', 'sound', 'Mini Bluetooth Speaker', '📻', 'purple', 'minimal', ['relaxed', 'cute'], 'Budget Bash', 15, '1 speaker', 1, fixed(1), 'Compact rechargeable speaker.'),
  p('mus-dj', 'music', 'sound', 'DJ for 2 Hours', '🎧', 'black', 'luxe', ['party', 'glam'], 'Snap Studio', 180, '2 hours', 2, fixed(1), 'DJ with lights and requests.'),

  p('pl-party-hits', 'music', 'playlist', 'Party Hits Playlist', '🎶', 'pink', 'modern', ['party', 'fun'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Curated upbeat party playlist.'),
  p('pl-chill', 'music', 'playlist', 'Chill Vibes Playlist', '🎵', 'blue', 'minimal', ['relaxed', 'elegant'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Laid-back background music.'),
  p('pl-singalong', 'music', 'playlist', 'Sing-Along Classics Playlist', '🎤', 'rainbow', 'retro', ['fun', 'colourful', 'cute'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Everyone-knows-the-words favourites.'),

  // ── Photography ────────────────────────────────────────────
  p('ph-props-glam', 'photography', 'props', 'Glam Photo Prop Set', '🕶️', 'gold', 'luxe', ['glam', 'party'], 'Party Lane', 12, '20 props', 20, fixed(1), 'Glasses, crowns and speech bubbles.'),
  p('ph-props-cute', 'photography', 'props', 'Pastel Photo Props', '🎀', 'pink', 'cute', ['cute', 'fun'], 'Budget Bash', 6, '15 props', 15, fixed(1), 'Bows, hearts and stars on sticks.'),
  p('ph-frame', 'photography', 'props', 'Giant Selfie Frame', '🖼️', 'purple', 'modern', ['fun', 'themed', 'party'], 'Craft Loft', 18, '1 frame', 1, fixed(1), 'Personalised cut-out frame.'),

  p('cam-instax-film', 'photography', 'camera', 'Instant Camera Film', '📸', 'white', 'retro', ['fun', 'cute', 'party'], 'Snap Studio', 22, '20 shots', 20, perGuest(10), 'Film packs for instant prints.'),
  p('cam-disposable', 'photography', 'camera', 'Disposable Cameras', '📷', 'blue', 'classic', ['fun', 'relaxed'], 'Budget Bash', 14, '1 camera', 1, perGuest(6), 'One camera per table of guests.'),
  p('cam-photographer', 'photography', 'camera', 'Photographer (1 hour)', '🧑‍🎨', 'black', 'luxe', ['elegant', 'glam'], 'Snap Studio', 150, '1 hour', 1, fixed(1), 'Edited digital gallery.'),

  // ── Extra touches ──────────────────────────────────────────
  p('lt-led-strip', 'extras', 'lighting', 'Colour-Changing LED Strip', '🌈', 'rainbow', 'modern', ['party', 'fun', 'colourful'], 'Budget Bash', 12, '5 m strip', 5, fixed(1), 'App-controlled lights.'),
  p('lt-lanterns', 'extras', 'lighting', 'Paper Lanterns', '🏮', 'white', 'boho', ['relaxed', 'elegant'], 'Craft Loft', 10, '6 lanterns', 6, fixed(1), 'Mixed-size white lanterns.'),
  p('lt-disco-ball', 'extras', 'lighting', 'Mirror Disco Ball', '🪩', 'silver', 'retro', ['party', 'glam'], 'Party Lane', 16, '1 ball', 1, fixed(1), 'Classic mirror ball with motor.'),

  p('wow-confetti', 'extras', 'wow', 'Confetti Cannons', '🎉', 'gold', 'classic', ['party', 'glam', 'fun'], 'Party Lane', 8, '2 cannons', 2, fixed(1), 'Biodegradable gold confetti.'),
  p('wow-bubbles', 'extras', 'wow', 'Bubble Machine', '🫧', 'blue', 'cute', ['cute', 'fun', 'relaxed'], 'Budget Bash', 20, '1 machine', 1, fixed(1), 'Hundreds of bubbles per minute.'),
  p('wow-cold-sparks', 'extras', 'wow', 'Smoke & Glow Entrance', '💜', 'purple', 'luxe', ['glam', 'party', 'themed'], 'Glow & Co', 40, '1 set', 1, fixed(1), 'Purple smoke bombs with LED uplights.'),
];

export function getProduct(id) {
  return CATALOG.find((x) => x.id === id) || null;
}

export function productsFor(categoryId, slotId) {
  return CATALOG.filter((x) => x.category === categoryId && (!slotId || x.slot === slotId));
}
