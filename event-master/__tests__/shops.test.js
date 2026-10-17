import { CATEGORIES } from '../src/data/categories';
import { CATALOG, getProduct } from '../src/data/catalog';
import { REAL_SHOPS, SLOT_SHOPS, isService, searchQuery, shopLinks } from '../src/data/shops';

describe('real shop links', () => {
  test('every shop links to its own https search page', () => {
    Object.values(REAL_SHOPS).forEach((s) => {
      const url = s.search('pink balloons');
      expect(url).toMatch(/^https:\/\/www\.[a-z.]+\//);
      expect(url).toContain('pink+balloons');
    });
  });

  test('every part of a party except playlists has shops', () => {
    CATEGORIES.flatMap((c) => c.slots).forEach((slot) => {
      if (slot.id === 'playlist') expect(SLOT_SHOPS[slot.id]).toBeUndefined();
      else expect(SLOT_SHOPS[slot.id].length).toBeGreaterThan(0);
    });
    Object.values(SLOT_SHOPS).flat().forEach((id) => expect(REAL_SHOPS[id]).toBeTruthy());
  });

  test('search text is the tidied item name, safely encoded', () => {
    expect(searchQuery({ name: 'Neon "Let\'s Party" Sign' })).toBe('neon lets party sign');
    expect(searchQuery({ name: 'Black & Gold Balloon Bundle' })).toBe('black gold balloon bundle');
    expect(searchQuery({ name: 'Star Piñata' })).toBe('star piñata');
    const [kmart] = shopLinks(getProduct('bal-purple-chrome'));
    expect(kmart).toEqual({ id: 'kmart', name: 'Kmart', url: 'https://www.kmart.com.au/search/?searchTerm=purple+chrome+balloons' });
  });

  test('hire services, people and playlists get no shop links', () => {
    const names = CATALOG.filter(isService).map((p) => p.name);
    ['Bouncy Castle Hire', 'Magician (45 min)', 'DJ for 2 Hours', 'Photographer (1 hour)', 'Party Hits Playlist'].forEach((n) => expect(names).toContain(n));
    expect(names).not.toContain('Mini Bluetooth Speaker');
    CATALOG.filter(isService).forEach((p) => expect(shopLinks(p)).toEqual([]));
  });

  test('every other product gets at least one shop', () => {
    CATALOG.filter((p) => !isService(p)).forEach((p) => expect(shopLinks(p).length).toBeGreaterThan(0));
  });
});
