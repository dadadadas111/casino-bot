import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import {
  BAIL_COST,
  DIVORCE_FEE,
  EconomyService,
  JAIL_MINUTES,
  ROB_COOLDOWN_MS,
  STARTING_BALANCE,
} from '../src/services/economy.service';
import { CashService } from '../src/services/cash.service';
import { ItemsService } from '../src/services/items.service';

let db: Db;
let economy: EconomyService;
let cashSvc: CashService;
let items: ItemsService;

const t0 = new Date('2026-08-13T10:00:00+07:00');

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
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
    const release = economy.jail('u1', JAIL_MINUTES, t0);
    expect(economy.jailedUntil('u1', t0)?.getTime()).toBe(release.getTime());
    expect(economy.jailedUntil('u1', new Date(release.getTime() + 1000))).toBeNull();
    expect(economy.bail('u1', t0)).toBe('ok');
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + 5_000 - BAIL_COST);
    expect(economy.jailedUntil('u1', t0)).toBeNull();
  });

  it('refuses bail when broke or free', () => {
    expect(economy.bail('u1', t0)).toBe('not_jailed');
    economy.debit('u1', STARTING_BALANCE - 100, 'bet');
    economy.jail('u1', JAIL_MINUTES, t0);
    expect(economy.bail('u1', t0)).toBe('poor');
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
