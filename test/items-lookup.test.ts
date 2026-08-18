import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS, USABLE_ITEMS, findShopItem } from '../src/services/items.service.js';

describe('findShopItem', () => {
  it('matches the exact key', () => {
    expect(findShopItem('buamayman')?.key).toBe('buamayman');
  });

  it('matches the full name with diacritics and spaces', () => {
    expect(findShopItem('Bùa may mắn')?.key).toBe('buamayman');
    expect(findShopItem('mũ bảo hiểm')?.key).toBe('mubaohiem');
  });

  it('accepts an unambiguous prefix', () => {
    expect(findShopItem('bua')?.key).toBe('buamayman');
    expect(findShopItem('caphe')?.key).toBe('caphe');
  });

  it('refuses to guess when a prefix is ambiguous', () => {
    // "h" opens both hopqua and hinhnom.
    expect(findShopItem('h')).toBeNull();
  });

  it('returns null on empty or unknown input', () => {
    expect(findShopItem('')).toBeNull();
    expect(findShopItem('   ')).toBeNull();
    expect(findShopItem('xe tang')).toBeNull();
  });

  it('honours a restricted pool so unusable items cannot be used', () => {
    expect(findShopItem('khien', USABLE_ITEMS)).toBeNull();
    expect(findShopItem('chiakhoa', USABLE_ITEMS)?.key).toBe('chiakhoa');
  });

  it('resolves every shop key by its own key', () => {
    for (const key of Object.keys(SHOP_ITEMS)) {
      expect(findShopItem(key)?.key).toBe(key);
    }
  });
});
