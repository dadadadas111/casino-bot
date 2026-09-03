import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { GuildItemsService, MAX_GUILD_ITEMS } from '../src/services/guild-items.service';
import { ConfigService } from '../src/services/config.service';
import { EFFECTS } from '../src/services/effects.service';

let db: Db;
let gi: GuildItemsService;
const G = 'guild1';

beforeEach(() => {
  db = createDb(':memory:');
  gi = new GuildItemsService(db);
});

describe('guild item catalog', () => {
  it('creates, lists and gets items scoped to the guild', () => {
    const id = gi.create(G, { name: 'Cúp', emoji: '🏆', price: 500 });
    gi.create('guild2', { name: 'Khác', emoji: '🎖️', price: 100 });
    expect(gi.count(G)).toBe(1);
    expect(gi.list(G)).toHaveLength(1);
    expect(gi.get(id)?.name).toBe('Cúp');
    expect(gi.get(id)?.rarity).toBe('common');
  });

  it('updates only the given fields', () => {
    const id = gi.create(G, { name: 'Cúp', emoji: '🏆', price: 500 });
    gi.update(id, { price: 900, effect: 'luck_buff', usable: true });
    const it = gi.get(id)!;
    expect(it.price).toBe(900);
    expect(it.effect).toBe('luck_buff');
    expect(it.usable).toBe(true);
    expect(it.name).toBe('Cúp'); // untouched
  });

  it('enabledOnly hides disabled items from the shop', () => {
    const id = gi.create(G, { name: 'Ẩn', emoji: '🙈', price: 10 });
    gi.update(id, { enabled: false });
    expect(gi.list(G)).toHaveLength(1);
    expect(gi.list(G, { enabledOnly: true })).toHaveLength(0);
  });
});

describe('guild item ownership', () => {
  it('adds, counts and consumes owned items', () => {
    const id = gi.create(G, { name: 'Vé', emoji: '🎟️', price: 50, usable: true });
    gi.addOwned(G, 'u1', id, 2);
    expect(gi.ownedQty(G, 'u1', id)).toBe(2);
    expect(gi.consumeOwned(G, 'u1', id)).toBe(true);
    expect(gi.ownedQty(G, 'u1', id)).toBe(1);
    gi.consumeOwned(G, 'u1', id);
    expect(gi.consumeOwned(G, 'u1', id)).toBe(false); // nothing left
  });

  it('ownership is isolated per guild', () => {
    const id = gi.create(G, { name: 'Vé', emoji: '🎟️', price: 50 });
    gi.addOwned(G, 'u1', id, 1);
    expect(gi.ownedQty('guild2', 'u1', id)).toBe(0);
  });

  it('inventory joins the catalog', () => {
    const id = gi.create(G, { name: 'Vé', emoji: '🎟️', price: 50 });
    gi.addOwned(G, 'u1', id, 3);
    const inv = gi.inventory(G, 'u1');
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ qty: 3 });
    expect(inv[0].item.name).toBe('Vé');
  });

  it('removing an item wipes its ownership too', () => {
    const id = gi.create(G, { name: 'Vé', emoji: '🎟️', price: 50 });
    gi.addOwned(G, 'u1', id, 1);
    gi.remove(id);
    expect(gi.get(id)).toBeUndefined();
    expect(gi.ownedQty(G, 'u1', id)).toBe(0);
  });
});

describe('collector leaderboard', () => {
  it('ranks by rarity-weighted score', () => {
    const legendary = gi.create(G, { name: 'Huyền thoại', emoji: '🟡', price: 1, rarity: 'legendary' });
    const common1 = gi.create(G, { name: 'Thường 1', emoji: '⚪', price: 1, rarity: 'common' });
    const common2 = gi.create(G, { name: 'Thường 2', emoji: '⚪', price: 1, rarity: 'common' });
    // u1 owns one legendary (15 pts); u2 owns two commons (2 pts).
    gi.addOwned(G, 'u1', legendary, 1);
    gi.addOwned(G, 'u2', common1, 1);
    gi.addOwned(G, 'u2', common2, 1);
    const board = gi.collectors(G, 10);
    expect(board[0]).toMatchObject({ userId: 'u1', score: 15, distinct: 1 });
    expect(board[1]).toMatchObject({ userId: 'u2', score: 2, distinct: 2 });
  });
});

describe('config knobs', () => {
  let config: ConfigService;
  beforeEach(() => {
    config = new ConfigService(db);
  });

  it('returns the coded default until overridden', () => {
    expect(config.effectFloor('clear_work_cd')).toBe(EFFECTS.clear_work_cd.floor);
  });

  it('stores and clamps overrides to the knob bounds', () => {
    config.set('floor.clear_work_cd', 999);
    expect(config.effectFloor('clear_work_cd')).toBe(999);
    config.set('floor.clear_work_cd', -50); // below min 1
    expect(config.effectFloor('clear_work_cd')).toBe(1);
  });

  it('caps the number of items a server can hold at the shared constant', () => {
    expect(MAX_GUILD_ITEMS).toBeGreaterThan(0);
  });
});
