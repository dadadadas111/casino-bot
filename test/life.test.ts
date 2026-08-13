import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import {
  BAIL_COST,
  DIVORCE_FEE,
  EconomyService,
  HOSPITAL_DURATION_MS,
  JAIL_DURATION_MS,
  ROB_COOLDOWN_MS,
  STARTING_BALANCE,
} from '../src/services/economy.service';
import { CashService } from '../src/services/cash.service';
import { ItemsService, SHOP_ITEMS } from '../src/services/items.service';
import { BUFFS, BuffService } from '../src/services/buff.service';

let db: Db;
let economy: EconomyService;
let cashSvc: CashService;
let items: ItemsService;
let buffs: BuffService;

const t0 = new Date('2026-08-13T10:00:00+07:00');

beforeEach(() => {
  db = createDb(':memory:');
  buffs = new BuffService(db);
  economy = new EconomyService(db, buffs);
  cashSvc = new CashService(db);
  items = new ItemsService(db);
});

describe('bank', () => {
  it('moves money between wallet and vault with conditions', () => {
    expect(economy.depositBank('u1', 400)).toBe(true);
    expect(economy.getBalance('u1')).toBe(600);
    expect(economy.getBank('u1')).toBe(400);
    expect(economy.depositBank('u1', 601)).toBe(false);
    expect(economy.withdrawBank('u1', 100)).toBe(true);
    expect(economy.getBalance('u1')).toBe(700);
    expect(economy.withdrawBank('u1', 301)).toBe(false);
  });
});

describe('jail and bail', () => {
  it('jails, reports release time, and bails for a fee', () => {
    economy.credit('u1', 5_000, 'admin_add'); // afford the bail
    expect(economy.jailedUntil('u1', t0)).toBeNull();
    const release = economy.jail('u1', JAIL_DURATION_MS, t0);
    expect(economy.jailedUntil('u1', t0)?.getTime()).toBe(release.getTime());
    expect(economy.jailedUntil('u1', new Date(release.getTime() + 1000))).toBeNull();
    expect(economy.bail('u1', t0)).toBe('ok');
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + 5_000 - BAIL_COST);
    expect(economy.jailedUntil('u1', t0)).toBeNull();
  });

  it('refuses bail when broke or free', () => {
    expect(economy.bail('u1', t0)).toBe('not_jailed');
    economy.debit('u1', STARTING_BALANCE - 50, 'bet'); // 50 xu left, under the 100 fee
    economy.jail('u1', JAIL_DURATION_MS, t0);
    expect(economy.bail('u1', t0)).toBe('poor');
  });
});

describe('hospital', () => {
  it('admits, expires on schedule, and discharges for a fee', () => {
    economy.credit('u1', 5_000, 'admin_add');
    expect(economy.hospitalizedUntil('u1', t0)).toBeNull();
    const until = economy.hospitalize('u1', HOSPITAL_DURATION_MS, t0);
    expect(economy.hospitalizedUntil('u1', t0)?.getTime()).toBe(until.getTime());
    expect(economy.hospitalizedUntil('u1', new Date(until.getTime() + 1))).toBeNull();
    expect(economy.payMedicalBill('u1', t0)).toBe('ok');
    expect(economy.hospitalizedUntil('u1', t0)).toBeNull();
  });

  it('refuses discharge when healthy or broke', () => {
    expect(economy.payMedicalBill('u1', t0)).toBe('not_admitted');
    economy.debit('u1', STARTING_BALANCE - 50, 'bet'); // 50 xu left, under the 100 fee
    economy.hospitalize('u1', HOSPITAL_DURATION_MS, t0);
    expect(economy.payMedicalBill('u1', t0)).toBe('poor');
  });

  it('is independent of jail', () => {
    economy.jail('u1', JAIL_DURATION_MS, t0);
    expect(economy.hospitalizedUntil('u1', t0)).toBeNull();
    economy.hospitalize('u2', HOSPITAL_DURATION_MS, t0);
    expect(economy.jailedUntil('u2', t0)).toBeNull();
  });
});

describe('robbery', () => {
  it('steals a slice of the victim wallet on success', () => {
    economy.credit('victim', 9_000, 'admin_add'); // wallet 10.000
    const outcome = economy.tryRob('thief', 'victim', t0, 0.1);
    expect(outcome.result).toBe('success');
    if (outcome.result === 'success') {
      expect(outcome.amount).toBe(1_500); // 15% of 10.000
      expect(economy.getBalance('thief')).toBe(STARTING_BALANCE + 1_500);
      expect(economy.getBalance('victim')).toBe(8_500);
    }
  });

  it('jails the thief on failure and enforces the cooldown', () => {
    economy.credit('victim', 9_000, 'admin_add');
    const fail = economy.tryRob('thief', 'victim', t0, 0.9);
    expect(fail.result).toBe('jailed');
    expect(economy.jailedUntil('thief', t0)).not.toBeNull();
    const again = economy.tryRob('thief', 'victim', new Date(t0.getTime() + 1000), 0.1);
    expect(again.result).toBe('cooldown');
    const later = economy.tryRob(
      'thief',
      'victim',
      new Date(t0.getTime() + ROB_COOLDOWN_MS + 1000),
      0.1,
    );
    expect(later.result).toBe('success');
  });

  it('skips poor victims without consuming the cooldown', () => {
    economy.debit('victim', 600, 'bet'); // wallet 400, below the 500 floor
    expect(economy.tryRob('thief', 'victim', t0, 0.1).result).toBe('victim_poor');
    economy.credit('victim', 9_000, 'admin_add');
    expect(economy.tryRob('thief', 'victim', t0, 0.1).result).toBe('success');
  });
});

describe('marriage', () => {
  it('marries two singles and blocks bigamy', () => {
    expect(economy.marry('a', 'b', t0)).toBe(true);
    expect(economy.spouseOf('a')).toBe('b');
    expect(economy.spouseOf('b')).toBe('a');
    expect(economy.marry('a', 'c', t0)).toBe(false);
    expect(economy.marry('c', 'b', t0)).toBe(false);
  });

  it('divorces for a fee and frees both sides', () => {
    economy.marry('a', 'b', t0);
    const result = economy.divorce('a');
    expect(result).toMatchObject({ ok: true, ex: 'b' });
    expect(economy.getBalance('a')).toBe(STARTING_BALANCE - DIVORCE_FEE);
    expect(economy.spouseOf('a')).toBeNull();
    expect(economy.spouseOf('b')).toBeNull();
    expect(economy.divorce('a')).toMatchObject({ ok: false, reason: 'single' });
  });
});

describe('cash (premium currency)', () => {
  it('credits and spends with a ledger, never negative', () => {
    expect(cashSvc.get('u1')).toBe(0);
    cashSvc.credit('u1', 10_000, 'manual:owner');
    expect(cashSvc.get('u1')).toBe(10_000);
    expect(cashSvc.spend('u1', 2_000, 'trieuphu_reset')).toBe(true);
    expect(cashSvc.get('u1')).toBe(8_000);
    expect(cashSvc.spend('u1', 9_000, 'trieuphu_reset')).toBe(false);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM cash_ledger').get() as { n: number };
    expect(rows.n).toBe(2);
  });
});

describe('lucky charm buff', () => {
  it('expires on its own schedule and extends when reapplied', () => {
    const until = buffs.activate('u1', 'mayman', t0);
    expect(until.getTime()).toBe(t0.getTime() + BUFFS.mayman.durationMs);
    expect(buffs.activeUntil('u1', 'mayman', t0)).not.toBeNull();
    const afterExpiry = new Date(until.getTime() + 1000);
    expect(buffs.activeUntil('u1', 'mayman', afterExpiry)).toBeNull();
    expect(buffs.activeList('u1', afterExpiry)).toEqual([]);

    // Re-buying mid-buff extends rather than resets.
    const midway = new Date(t0.getTime() + 10 * 60 * 1000);
    const extended = buffs.activate('u1', 'mayman', midway);
    expect(extended.getTime()).toBe(until.getTime() + BUFFS.mayman.durationMs);
  });

  it('adds 10% to winnings only, never to losses or pushes', () => {
    buffs.activate('winner', 'mayman', t0);
    economy.debit('winner', 100, 'bet', 'taixiu');
    economy.settleGame('winner', 100, 300, 'taixiu', t0); // net +200, bonus +20
    expect(economy.getBalance('winner')).toBe(STARTING_BALANCE + 220);
    expect(economy.getProfile('winner').totalWon).toBe(220);

    buffs.activate('loser', 'mayman', t0);
    economy.debit('loser', 100, 'bet', 'slots');
    economy.settleGame('loser', 100, 0, 'slots', t0);
    expect(economy.getBalance('loser')).toBe(STARTING_BALANCE - 100);

    economy.debit('pusher', 100, 'bet', 'blackjack');
    buffs.activate('pusher', 'mayman', t0);
    economy.settleGame('pusher', 100, 100, 'blackjack', t0); // push
    expect(economy.getBalance('pusher')).toBe(STARTING_BALANCE);
  });

  it('does nothing once the buff has lapsed', () => {
    const until = buffs.activate('u1', 'mayman', t0);
    economy.debit('u1', 100, 'bet', 'taixiu');
    economy.settleGame('u1', 100, 300, 'taixiu', new Date(until.getTime() + 1000));
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + 200);
  });
});

describe('shop pricing', () => {
  it('keeps every item at or under 1.000 xu', () => {
    for (const item of Object.values(SHOP_ITEMS)) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.price).toBeLessThanOrEqual(1_000);
    }
  });

  it('sells a helmet that survivors of roulette can burn', () => {
    expect(SHOP_ITEMS.mubaohiem).toBeDefined();
    items.add('u1', 'mubaohiem');
    expect(items.consume('u1', 'mubaohiem')).toBe(true);
    expect(items.consume('u1', 'mubaohiem')).toBe(false);
  });
});

describe('items', () => {
  it('adds, counts, and consumes inventory', () => {
    items.add('u1', 'khien');
    items.add('u1', 'khien');
    expect(items.count('u1', 'khien')).toBe(2);
    expect(items.consume('u1', 'khien')).toBe(true);
    expect(items.count('u1', 'khien')).toBe(1);
    expect(items.consume('u1', 'nhan')).toBe(false);
    expect(items.inventory('u1')).toEqual([{ item: 'khien', qty: 1 }]);
  });
});
