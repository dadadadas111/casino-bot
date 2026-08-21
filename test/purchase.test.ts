import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { ItemsService, SHOP_ITEMS } from '../src/services/items.service';

/**
 * Bulk buy is charge-price×qty then stack, and it must be all-or-nothing: a
 * wallet that cannot cover the full order buys none. purchase() itself lives in
 * a command module (which drags the bot context), so the rules are pinned here
 * against the economy + items pair it is built from.
 */
describe('buying in bulk', () => {
  let db: Db;
  let economy: EconomyService;
  let items: ItemsService;
  const ME = 'shopper';

  beforeEach(() => {
    db = createDb(':memory:');
    economy = new EconomyService(db);
    items = new ItemsService(db);
    economy.ensureUser(ME);
    economy.setBalance(ME, 100_000);
  });

  it('charges price × quantity and stacks the item', () => {
    const helmet = SHOP_ITEMS.mubaohiem;
    const before = economy.getBalance(ME);
    expect(economy.debit(ME, helmet.price * 3, 'item', 'mubaohiemx3')).toBe(true);
    items.add(ME, 'mubaohiem', 3);
    expect(economy.getBalance(ME)).toBe(before - helmet.price * 3);
    expect(items.count(ME, 'mubaohiem')).toBe(3);
  });

  it('adds to an existing stack rather than replacing it', () => {
    items.add(ME, 'khien', 2);
    items.add(ME, 'khien', 3);
    expect(items.count(ME, 'khien')).toBe(5);
  });

  it('refuses the whole order when the wallet is short, buying nothing', () => {
    economy.setBalance(ME, SHOP_ITEMS.mubaohiem.price * 2);
    // A single debit of the full cost is how purchase() charges, so a short
    // wallet fails atomically before any item is added.
    expect(economy.debit(ME, SHOP_ITEMS.mubaohiem.price * 3, 'item', 'x')).toBe(false);
    expect(items.count(ME, 'mubaohiem')).toBe(0);
    expect(economy.getBalance(ME)).toBe(SHOP_ITEMS.mubaohiem.price * 2);
  });
});
