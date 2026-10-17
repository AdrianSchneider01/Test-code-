// REAL AUSTRALIAN SHOPS
//
// Event Master links to each shop's own SEARCH page for an item, never to a
// specific product. The shop then shows its real, current products and
// prices, so no product facts are invented here.
//
// Only shops whose search address is known are listed. If a shop changes its
// search address, fix the one `search` line below.

const enc = (q) => encodeURIComponent(q).replace(/%20/g, '+');

export const REAL_SHOPS = {
  kmart: { name: 'Kmart', search: (q) => `https://www.kmart.com.au/search/?searchTerm=${enc(q)}` },
  bigw: { name: 'BIG W', search: (q) => `https://www.bigw.com.au/search?text=${enc(q)}` },
  officeworks: { name: 'Officeworks', search: (q) => `https://www.officeworks.com.au/shop/officeworks/search?q=${enc(q)}` },
  woolworths: { name: 'Woolworths', search: (q) => `https://www.woolworths.com.au/shop/search/products?searchTerm=${enc(q)}` },
  amazon: { name: 'Amazon AU', search: (q) => `https://www.amazon.com.au/s?k=${enc(q)}` },
  ebay: { name: 'eBay AU', search: (q) => `https://www.ebay.com.au/sch/i.html?_nkw=${enc(q)}` },
  etsy: { name: 'Etsy', search: (q) => `https://www.etsy.com/search?q=${enc(q)}` },
};

// Where it makes sense to look for each part of a party, best first.
export const SLOT_SHOPS = {
  balloons: ['kmart', 'bigw', 'amazon'],
  banner: ['kmart', 'etsy', 'amazon'],
  table: ['kmart', 'woolworths', 'bigw'],
  backdrop: ['kmart', 'amazon', 'etsy'],
  mains: ['woolworths'],
  snacks: ['woolworths'],
  drinks: ['woolworths'],
  cake: ['woolworths'],
  candles: ['kmart', 'woolworths', 'etsy'],
  activity: ['kmart', 'bigw', 'amazon'],
  game: ['kmart', 'bigw', 'etsy'],
  invites: ['officeworks', 'etsy', 'kmart'],
  bags: ['kmart', 'officeworks', 'bigw'],
  fillers: ['kmart', 'bigw', 'amazon'],
  sound: ['bigw', 'kmart', 'amazon'],
  camera: ['officeworks', 'bigw', 'amazon'],
  props: ['kmart', 'etsy', 'amazon'],
  lighting: ['kmart', 'bigw', 'amazon'],
  wow: ['amazon', 'kmart', 'ebay'],
  // playlist: not something you buy in a shop
};

// People and hire services (a magician, a DJ, a bouncy castle hire…) and
// playlists aren't sold in these shops, so they get no shop links.
const SERVICE = /\b(hire|magician|painter|dj|musician|photographer|playlist)\b|\(\d|gallery qr/i;

export function isService(product) {
  return SERVICE.test(product.name);
}

// What to type into the shop's search box: the item's name, tidied up.
export function searchQuery(product) {
  return product.name
    .replace(/["“”'’]/g, '')
    .replace(/[&+]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// [{ id, name, url }] — the shops to search for this product (may be empty).
export function shopLinks(product) {
  if (!product || isService(product)) return [];
  const q = searchQuery(product);
  return (SLOT_SHOPS[product.slot] || []).map((id) => ({ id, name: REAL_SHOPS[id].name, url: REAL_SHOPS[id].search(q) }));
}
