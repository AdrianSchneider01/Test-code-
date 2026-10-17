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

export const SHOPS = ['Party Lane', 'Glow & Co', 'Craft Loft', 'Budget Bash', 'Sweet Street', 'Snap Studio', 'Little Lantern', 'Confetti Corner', 'Petal & Plate'];

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
  // ── More options (sample catalogue, expanded) ──────────────
  // Balloons
  p('bal-pastel-mix', 'decorations', 'balloons', 'Pastel Rainbow Balloons', '🎈', 'rainbow', 'cute', ['cute', 'colourful', 'relaxed'], 'Confetti Corner', 6, '25 balloons', 25, perGuest(12), 'Soft pastel latex in six shades.'),
  p('bal-black-gold', 'decorations', 'balloons', 'Black & Gold Balloon Bundle', '🎈', 'black', 'luxe', ['glam', 'elegant', 'party'], 'Glow & Co', 15, '20 balloons', 20, perGuest(10), 'Matte black with gold chrome accents.'),
  p('bal-blue-ocean', 'decorations', 'balloons', 'Ocean Blue Balloons', '🎈', 'blue', 'classic', ['themed', 'relaxed', 'fun'], 'Party Lane', 6, '20 balloons', 20, perGuest(10), 'Blues and whites for a seaside feel.'),
  p('bal-green-garden', 'decorations', 'balloons', 'Sage Garden Balloon Kit', '🎈', 'green', 'boho', ['relaxed', 'elegant'], 'Petal & Plate', 18, '30 balloons + eucalyptus', 30, perGuest(15), 'Sage and cream balloons with faux greenery.'),
  p('bal-number-foil', 'decorations', 'balloons', 'Giant Foil Number Balloon', '🔢', 'gold', 'classic', ['party', 'fun', 'glam'], 'Budget Bash', 5, '1 balloon', 1, fixed(1), '1 m foil number, any digit.'),
  p('bal-star-cluster', 'decorations', 'balloons', 'Silver Star Balloon Cluster', '⭐', 'silver', 'modern', ['party', 'glam', 'themed'], 'Little Lantern', 11, '5 foil stars', 5, fixed(1), 'Mixed-size silver foil stars.'),
  // Banners
  p('ban-floral-garland', 'decorations', 'banner', 'Paper Flower Garland', '🌸', 'pink', 'boho', ['elegant', 'relaxed', 'cute'], 'Petal & Plate', 14, '2 m garland', 2, fixed(1), 'Layered paper blooms in blush tones.'),
  p('ban-tassel-rainbow', 'decorations', 'banner', 'Rainbow Tassel Garland', '🎐', 'rainbow', 'retro', ['colourful', 'fun', 'party'], 'Confetti Corner', 7, '3 m garland', 3, fixed(1), 'Tissue tassels in bright colours.'),
  p('ban-wood-sign', 'decorations', 'banner', 'Personalised Wooden Sign', '🪵', 'natural', 'boho', ['relaxed', 'elegant'], 'Craft Loft', 32, '1 sign', 1, fixed(1), 'Laser-cut sign with your message.'),
  p('ban-black-gold', 'decorations', 'banner', 'Black & Gold Fringe Banner', '🎊', 'black', 'luxe', ['glam', 'party'], 'Glow & Co', 9, '1 banner', 1, fixed(1), 'Foil fringe with a glossy black backing.'),
  p('ban-pennant-blue', 'decorations', 'banner', 'Blue Pennant Flags', '🚩', 'blue', 'classic', ['themed', 'fun', 'relaxed'], 'Budget Bash', 3, '4 m flags', 4, fixed(1), 'Classic triangle flags in blues.'),
  // Table settings
  p('tab-rainbow-brights', 'decorations', 'table', 'Rainbow Brights Tableware', '🍽️', 'rainbow', 'retro', ['colourful', 'fun', 'party'], 'Confetti Corner', 8, 'serves 10', 10, perGuest(10), 'Mix-and-match bright plates and cups.'),
  p('tab-black-gold', 'decorations', 'table', 'Black & Gold Tableware', '🍽️', 'black', 'luxe', ['glam', 'elegant', 'party'], 'Glow & Co', 16, 'serves 10', 10, perGuest(10), 'Matte black plates with gold cutlery.'),
  p('tab-floral', 'decorations', 'table', 'Floral Garden Tableware', '🍽️', 'pink', 'boho', ['elegant', 'relaxed', 'cute'], 'Petal & Plate', 12, 'serves 8', 8, perGuest(8), 'Pressed-flower print plates and napkins.'),
  p('tab-blue-stripe', 'decorations', 'table', 'Blue Stripe Tableware', '🍽️', 'blue', 'classic', ['relaxed', 'themed'], 'Party Lane', 7, 'serves 10', 10, perGuest(10), 'Nautical stripes with matching cups.'),
  p('tab-reusable-bamboo', 'decorations', 'table', 'Reusable Bamboo Tableware', '🍽️', 'natural', 'minimal', ['relaxed', 'elegant'], 'Little Lantern', 20, 'serves 8', 8, perGuest(8), 'Washable bamboo plates and cups.'),
  // Backdrops
  p('bd-balloon-wall', 'decorations', 'backdrop', 'Pastel Balloon Wall Kit', '🎈', 'pink', 'cute', ['cute', 'colourful', 'party'], 'Confetti Corner', 26, '1 wall kit', 1, fixed(1), 'Frame, clips and 120 pastel balloons.'),
  p('bd-starry-night', 'decorations', 'backdrop', 'Starry Night Backdrop', '🌌', 'blue', 'modern', ['themed', 'relaxed', 'party'], 'Little Lantern', 22, '2 × 2 m', 2, fixed(1), 'Navy fabric with twinkling LED stars.'),
  p('bd-gold-sequin', 'decorations', 'backdrop', 'Gold Sequin Wall', '✨', 'gold', 'luxe', ['glam', 'elegant', 'party'], 'Glow & Co', 30, '2 × 2 m', 2, fixed(1), 'Shimmer panels that move in the light.'),
  p('bd-rainbow-streamers', 'decorations', 'backdrop', 'Rainbow Streamer Wall', '🌈', 'rainbow', 'retro', ['colourful', 'fun'], 'Budget Bash', 5, '10 streamers', 10, fixed(1), 'Crepe streamers in a rainbow sweep.'),
  p('bd-floral-arch', 'decorations', 'backdrop', 'Floral Arch Hire', '💐', 'white', 'luxe', ['elegant', 'relaxed'], 'Petal & Plate', 85, '1 day hire', 1, fixed(1), 'Silk-flower arch, delivered and collected.'),
  // Mains
  p('food-taco-bar', 'food', 'mains', 'Build-Your-Own Taco Bar', '🌮', 'natural', 'modern', ['fun', 'party', 'relaxed'], 'Sweet Street', 40, 'serves 10', 10, perGuest(10), 'Shells, fillings and toppings to share.'),
  p('food-mini-pies', 'food', 'mains', 'Mini Party Pies & Rolls', '🥧', 'natural', 'classic', ['fun', 'relaxed'], 'Budget Bash', 16, '24 pieces', 24, perGuest(8), 'Classic party pies and sausage rolls.'),
  p('food-sushi', 'food', 'mains', 'Sushi Platter', '🍣', 'natural', 'minimal', ['elegant', 'relaxed'], 'Petal & Plate', 48, '40 pieces', 40, perGuest(10), 'Assorted rolls with soy and ginger.'),
  p('food-pasta-trays', 'food', 'mains', 'Pasta Party Trays', '🍝', 'natural', 'classic', ['relaxed', 'fun'], 'Sweet Street', 35, 'serves 8', 8, perGuest(8), 'Two baked pasta trays.'),
  p('food-hotdogs', 'food', 'mains', 'Hot Dog Station', '🌭', 'natural', 'retro', ['fun', 'party', 'themed'], 'Party Lane', 24, 'serves 12', 12, perGuest(12), 'Rolls, franks and sauces.'),
  p('food-canapes', 'food', 'mains', 'Canapé Selection', '🥂', 'white', 'luxe', ['elegant', 'glam'], 'Glow & Co', 60, '30 canapés', 30, perGuest(10), 'Chef-made bites for grazing.'),
  // Snacks
  p('snk-lolly-bar', 'food', 'snacks', 'Lolly Buffet', '🍬', 'rainbow', 'retro', ['colourful', 'fun', 'party'], 'Confetti Corner', 25, 'serves 15', 15, perGuest(15), 'Jars of mixed lollies with scoops and bags.'),
  p('snk-veggie-cups', 'food', 'snacks', 'Veggie & Dip Cups', '🥕', 'green', 'minimal', ['relaxed', 'elegant'], 'Petal & Plate', 2.5, '1 cup', 1, perGuest(1), 'Crunchy veggie sticks with hummus.'),
  p('snk-cake-pops', 'food', 'snacks', 'Cake Pops', '🍭', 'pink', 'cute', ['cute', 'party', 'colourful'], 'Sweet Street', 18, '12 pops', 12, perGuest(12), 'Vanilla cake pops dipped in pink.'),
  p('snk-donut-wall', 'food', 'snacks', 'Donut Wall', '🍩', 'pink', 'modern', ['fun', 'party', 'themed'], 'Sweet Street', 30, '20 donuts', 20, perGuest(20), 'Peg-board display with glazed donuts.'),
  p('snk-cheese-crackers', 'food', 'snacks', 'Cheese & Crackers Board', '🧀', 'natural', 'classic', ['relaxed', 'elegant'], 'Budget Bash', 14, 'serves 10', 10, perGuest(10), 'Cheddar, brie and crackers.'),
  // Drinks
  p('drk-hot-choc', 'food', 'drinks', 'Hot Chocolate Bar', '☕', 'natural', 'cute', ['cute', 'relaxed', 'themed'], 'Little Lantern', 22, 'serves 12', 12, perGuest(12), 'Cocoa with marshmallows and toppings.'),
  p('drk-slushie', 'food', 'drinks', 'Slushie Machine Hire', '🧊', 'blue', 'retro', ['fun', 'party', 'colourful'], 'Party Lane', 55, '1 day hire', 1, fixed(1), 'Two flavours, unlimited cups.'),
  p('drk-milkshake', 'food', 'drinks', 'Milkshake Station', '🥤', 'pink', 'retro', ['fun', 'cute', 'themed'], 'Sweet Street', 28, 'serves 10', 10, perGuest(10), 'Three flavours with sprinkles and straws.'),
  p('drk-sparkling-water', 'food', 'drinks', 'Sparkling Water Bottles', '💧', 'white', 'minimal', ['relaxed', 'elegant'], 'Budget Bash', 6, '12 bottles', 12, perGuest(12), 'Lightly flavoured sparkling water.'),
  p('drk-punch-bowl', 'food', 'drinks', 'Party Punch Bowl Kit', '🍹', 'rainbow', 'classic', ['party', 'fun'], 'Confetti Corner', 15, 'serves 15', 15, perGuest(15), 'Fruit punch with a glass bowl and ladle.'),
  // Cake
  p('cake-unicorn', 'cake', 'cake', 'Unicorn Cake', '🦄', 'pink', 'cute', ['cute', 'themed', 'colourful'], 'Sweet Street', 70, 'serves 20', 20, perGuest(20), 'Rainbow layers with a gold horn.', 'cake'),
  p('cake-naked-berry', 'cake', 'cake', 'Naked Berry Cake', '🍓', 'white', 'boho', ['elegant', 'relaxed'], 'Petal & Plate', 60, 'serves 16', 16, perGuest(16), 'Semi-naked sponge with fresh berries.', 'cake'),
  p('cake-black-gold', 'cake', 'cake', 'Black & Gold Drip Cake', '🎂', 'black', 'luxe', ['glam', 'party', 'elegant'], 'Glow & Co', 85, 'serves 20', 20, perGuest(20), 'Dark chocolate with a gold drip.', 'cake'),
  p('cake-cookie-cake', 'cake', 'cake', 'Giant Cookie Cake', '🍪', 'natural', 'retro', ['fun', 'relaxed'], 'Budget Bash', 28, 'serves 16', 16, perGuest(16), 'Chocolate-chip cookie with a message.', 'cake'),
  p('cake-pastel-cupcakes', 'cake', 'cake', 'Pastel Swirl Cupcakes', '🧁', 'pink', 'cute', ['cute', 'colourful'], 'Sweet Street', 3, '1 cupcake', 1, perGuest(1), 'Vanilla cupcakes with pastel swirls.', 'cupcakes'),
  p('cake-mini-cupcakes', 'cake', 'cake', 'Mini Cupcake Tower', '🧁', 'white', 'classic', ['elegant', 'party'], 'Little Lantern', 45, '48 minis', 48, perGuest(24), 'Bite-size cupcakes on a stand.', 'cupcakes'),
  // Candles
  p('cnd-fountain', 'cake', 'candles', 'Cake Fountain Sparkler', '🎆', 'silver', 'modern', ['party', 'glam'], 'Party Lane', 7, '2 fountains', 2, fixed(1), 'Indoor-safe sparkling fountain.'),
  p('cnd-pastel-twist', 'cake', 'candles', 'Pastel Twist Candles', '🕯️', 'pink', 'cute', ['cute', 'relaxed'], 'Confetti Corner', 4, '12 candles', 12, fixed(1), 'Spiral candles in pastel shades.'),
  p('cnd-gold-topper', 'cake', 'candles', 'Gold Happy Birthday Topper', '🎉', 'gold', 'classic', ['glam', 'elegant', 'party'], 'Budget Bash', 5, '1 topper', 1, fixed(1), 'Glitter card topper.'),
  p('cnd-flower-topper', 'cake', 'candles', 'Fresh Flower Topper', '🌼', 'white', 'boho', ['elegant', 'relaxed'], 'Petal & Plate', 18, '1 posy', 1, fixed(1), 'Food-safe fresh flower posy.'),
  // Main activities
  p('act-magician', 'activities', 'activity', 'Magician (45 min)', '🎩', 'black', 'classic', ['fun', 'themed', 'party'], 'Snap Studio', 220, '45 minutes', 1, fixed(1), 'Close-up magic and a stage show.'),
  p('act-face-paint', 'activities', 'activity', 'Face Painter (1 hour)', '🎨', 'rainbow', 'cute', ['cute', 'colourful', 'fun'], 'Snap Studio', 160, '1 hour', 1, fixed(1), 'Designs for every guest.'),
  p('act-craft-canvas', 'activities', 'activity', 'Mini Canvas Painting', '🖼️', 'white', 'boho', ['relaxed', 'cute', 'elegant'], 'Craft Loft', 5, 'per guest', 1, perGuest(1), 'Canvas, paints and brushes for each guest.'),
  p('act-tie-dye', 'activities', 'activity', 'Tie-Dye T-Shirt Kit', '👕', 'rainbow', 'retro', ['colourful', 'fun', 'themed'], 'Craft Loft', 9, 'per guest', 1, perGuest(1), 'Shirt, dyes and gloves per guest.'),
  p('act-bouncy-castle', 'activities', 'activity', 'Bouncy Castle Hire', '🏰', 'rainbow', 'classic', ['fun', 'party'], 'Party Lane', 190, '1 day hire', 1, fixed(1), 'Delivered and set up; suits backyards.'),
  p('act-cupcake-decor', 'activities', 'activity', 'Cupcake Decorating Kit', '🧁', 'pink', 'cute', ['cute', 'fun', 'relaxed'], 'Sweet Street', 4, 'per guest', 1, perGuest(1), 'Two cupcakes plus icing and toppings each.'),
  // Games
  p('gm-giant-games', 'activities', 'game', 'Giant Lawn Games Set', '🎲', 'natural', 'classic', ['fun', 'relaxed'], 'Party Lane', 45, '1 set', 1, fixed(1), 'Giant jenga, quoits and connect-four.'),
  p('gm-bingo', 'activities', 'game', 'Party Bingo', '🔢', 'rainbow', 'retro', ['fun', 'colourful'], 'Budget Bash', 6, 'up to 20 players', 20, perGuest(20), 'Bingo cards, dabbers and prizes list.'),
  p('gm-escape', 'activities', 'game', 'Printable Escape Room', '🗝️', 'black', 'modern', ['themed', 'fun'], 'Craft Loft', 12, '1 printable', 1, fixed(1), 'Puzzles and locks for teams of 4-6.'),
  p('gm-pass-parcel', 'activities', 'game', 'Pass the Parcel Kit', '🎁', 'pink', 'cute', ['cute', 'fun'], 'Confetti Corner', 14, '1 parcel', 1, fixed(1), 'Layers with mini prizes inside.'),
  p('gm-dance-off', 'activities', 'game', 'Dance-Off Cards', '💃', 'purple', 'retro', ['party', 'fun', 'glam'], 'Snap Studio', 8, '50 cards', 50, fixed(1), 'Challenge cards for a dance battle.'),
  // Invitations
  p('inv-floral-printed', 'invitations', 'invites', 'Floral Printed Invitations', '💐', 'pink', 'boho', ['elegant', 'relaxed'], 'Petal & Plate', 2.5, '1 card', 1, perGuest(1), 'Watercolour flowers on textured card.'),
  p('inv-black-gold', 'invitations', 'invites', 'Black & Gold Invitations', '✉️', 'black', 'luxe', ['glam', 'elegant', 'party'], 'Glow & Co', 3.5, '1 card', 1, perGuest(1), 'Black card with gold foil.'),
  p('inv-ticket', 'invitations', 'invites', 'Event Ticket Invitations', '🎟️', 'rainbow', 'retro', ['fun', 'themed', 'party'], 'Confetti Corner', 1.8, '1 ticket', 1, perGuest(1), 'Admit-one style tickets.'),
  p('inv-digital-cute', 'invitations', 'invites', 'Cute Digital Invitation', '📱', 'pink', 'cute', ['cute', 'fun'], 'Snap Studio', 6, 'unlimited sends', 1, fixed(1), 'Animated invite with RSVP tracking.'),
  p('inv-seed-paper', 'invitations', 'invites', 'Plantable Seed-Paper Invitations', '🌱', 'green', 'boho', ['relaxed', 'elegant'], 'Little Lantern', 4, '1 card', 1, perGuest(1), 'Plant the card and wildflowers grow.'),
  // Party bags
  p('bag-mini-backpack', 'favours', 'bags', 'Mini Backpacks', '🎒', 'rainbow', 'cute', ['cute', 'colourful', 'fun'], 'Confetti Corner', 3.5, '1 backpack', 1, perGuest(1), 'Drawstring backpacks in bright colours.'),
  p('bag-gold-box', 'favours', 'bags', 'Gold Gift Boxes', '🎁', 'gold', 'luxe', ['glam', 'elegant'], 'Glow & Co', 12, '10 boxes', 10, perGuest(10), 'Gold boxes with ribbon ties.'),
  p('bag-jar', 'favours', 'bags', 'Glass Treat Jars', '🫙', 'white', 'minimal', ['elegant', 'relaxed'], 'Little Lantern', 18, '12 jars', 12, perGuest(12), 'Clip-top jars with name tags.'),
  p('bag-paper-floral', 'favours', 'bags', 'Floral Paper Bags', '🛍️', 'pink', 'boho', ['relaxed', 'cute'], 'Petal & Plate', 6, '10 bags', 10, perGuest(10), 'Recycled bags with a flower print.'),
  // Bag fillers
  p('fil-bubbles', 'favours', 'fillers', 'Mini Bubble Wands', '🫧', 'blue', 'cute', ['cute', 'fun', 'relaxed'], 'Budget Bash', 4, '12 wands', 12, perGuest(12), 'Bubble wands in party colours.'),
  p('fil-stickers', 'favours', 'fillers', 'Sticker Sheets', '⭐', 'rainbow', 'cute', ['cute', 'colourful'], 'Confetti Corner', 5, '20 sheets', 20, perGuest(20), 'Puffy and glitter sticker sheets.'),
  p('fil-candle', 'favours', 'fillers', 'Mini Scented Candles', '🕯️', 'white', 'luxe', ['elegant', 'relaxed'], 'Little Lantern', 3, '1 candle', 1, perGuest(1), 'Soy candles in vanilla or berry.'),
  p('fil-seeds', 'favours', 'fillers', 'Flower Seed Packets', '🌻', 'green', 'boho', ['relaxed', 'elegant'], 'Petal & Plate', 1.5, '1 packet', 1, perGuest(1), 'Wildflower seeds with a thank-you tag.'),
  p('fil-cookies', 'favours', 'fillers', 'Iced Name Cookies', '🍪', 'pink', 'cute', ['cute', 'themed'], 'Sweet Street', 3.5, '1 cookie', 1, perGuest(1), 'Each guest’s name piped in icing.'),
  // Sound
  p('mus-karaoke-speaker', 'music', 'sound', 'Karaoke Speaker with Mics', '🎤', 'black', 'modern', ['party', 'fun'], 'Budget Bash', 49, '1 speaker', 1, fixed(1), 'Bluetooth speaker with two wireless mics.'),
  p('mus-pa-hire', 'music', 'sound', 'PA System Hire', '🔈', 'black', 'classic', ['party', 'elegant'], 'Snap Studio', 75, '1 day hire', 1, fixed(1), 'Two speakers, a mixer and a mic.'),
  p('mus-acoustic', 'music', 'sound', 'Acoustic Musician (1 hour)', '🎸', 'natural', 'boho', ['relaxed', 'elegant'], 'Snap Studio', 200, '1 hour', 1, fixed(1), 'Live guitar and vocals.'),
  // Playlists
  p('pl-disco', 'music', 'playlist', 'Disco Classics Playlist', '🪩', 'purple', 'retro', ['party', 'glam', 'themed'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Seventies and eighties floor-fillers.'),
  p('pl-kids-party', 'music', 'playlist', 'Kids Party Games Playlist', '🎈', 'rainbow', 'cute', ['cute', 'fun'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Songs for musical statues and chairs.'),
  p('pl-jazz', 'music', 'playlist', 'Elegant Jazz Playlist', '🎷', 'gold', 'classic', ['elegant', 'relaxed'], 'Snap Studio', 0, 'free playlist', 1, fixed(1), 'Smooth background jazz.'),
  // Photo props
  p('ph-props-disco', 'photography', 'props', 'Disco Photo Props', '🕺', 'silver', 'retro', ['party', 'themed', 'fun'], 'Confetti Corner', 9, '15 props', 15, fixed(1), 'Afros, glasses and mirror-ball signs.'),
  p('ph-props-floral', 'photography', 'props', 'Floral Crown Station', '👑', 'pink', 'boho', ['elegant', 'relaxed', 'cute'], 'Petal & Plate', 4, 'per guest', 1, perGuest(1), 'A flower crown for each guest.'),
  p('ph-polaroid-frame', 'photography', 'props', 'Polaroid Frame Cut-Out', '🖼️', 'white', 'modern', ['fun', 'party'], 'Budget Bash', 9, '1 frame', 1, fixed(1), 'Large instant-photo frame.'),
  // Camera & prints
  p('cam-photo-booth', 'photography', 'camera', 'Photo Booth Hire (3 hours)', '📸', 'black', 'modern', ['party', 'fun', 'glam'], 'Snap Studio', 350, '3 hours', 1, fixed(1), 'Instant prints and digital gallery.'),
  p('cam-guestbook', 'photography', 'camera', 'Photo Guestbook', '📔', 'gold', 'classic', ['elegant', 'relaxed'], 'Craft Loft', 25, '1 book', 1, fixed(1), 'Guests stick in photos and write messages.'),
  p('cam-qr-gallery', 'photography', 'camera', 'Shared Photo Gallery QR', '🔳', 'white', 'minimal', ['relaxed', 'party'], 'Snap Studio', 15, '1 gallery', 1, fixed(1), 'Guests upload photos by scanning a code.'),
  // Lighting
  p('lt-fairy-jars', 'extras', 'lighting', 'Fairy-Light Jars', '🫙', 'white', 'boho', ['relaxed', 'elegant', 'cute'], 'Little Lantern', 18, '6 jars', 6, fixed(1), 'Warm micro-LED lights in jars.'),
  p('lt-neon-pink', 'extras', 'lighting', 'Pink Neon Uplights', '💡', 'pink', 'modern', ['party', 'glam'], 'Glow & Co', 30, '4 uplights', 4, fixed(1), 'Colour wash for walls.'),
  p('lt-festoon', 'extras', 'lighting', 'Festoon String Lights', '💡', 'white', 'classic', ['relaxed', 'elegant', 'party'], 'Party Lane', 25, '10 m', 10, fixed(1), 'Outdoor-rated bulb lights.'),
  p('lt-candles-led', 'extras', 'lighting', 'LED Pillar Candles', '🕯️', 'white', 'luxe', ['elegant', 'relaxed'], 'Little Lantern', 20, '9 candles', 9, fixed(1), 'Flameless, safe around kids.'),
  // Wow moments
  p('wow-balloon-drop', 'extras', 'wow', 'Balloon Drop Net', '🎈', 'rainbow', 'retro', ['party', 'fun', 'colourful'], 'Confetti Corner', 22, '1 net + 100 balloons', 1, fixed(1), 'Release balloons from the ceiling.'),
  p('wow-sparkler-send', 'extras', 'wow', 'Sparkler Send-Off', '🎇', 'gold', 'classic', ['elegant', 'glam', 'party'], 'Party Lane', 12, '36 sparklers', 36, perGuest(36), 'Long-burn outdoor sparklers.'),
  p('wow-snow-machine', 'extras', 'wow', 'Snow Machine Hire', '❄️', 'white', 'modern', ['themed', 'fun', 'glam'], 'Snap Studio', 65, '1 day hire', 1, fixed(1), 'Soft foam snow for a magical moment.'),
  p('wow-giant-confetti', 'extras', 'wow', 'Giant Confetti Balloon Pop', '🎉', 'pink', 'cute', ['cute', 'party', 'fun'], 'Budget Bash', 9, '1 balloon', 1, fixed(1), '90 cm balloon filled with confetti.'),
];

export function getProduct(id) {
  return CATALOG.find((x) => x.id === id) || null;
}

export function productsFor(categoryId, slotId) {
  return CATALOG.filter((x) => x.category === categoryId && (!slotId || x.slot === slotId));
}
