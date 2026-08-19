import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { BuffService } from '../src/services/buff.service';
import { ASSETS, AssetsService, SEIZE_RATE } from '../src/services/assets.service';
import { LOAN_MIN, LoanService, amountDue } from '../src/services/loan.service';

let db: Db;
let economy: EconomyService;
let assets: AssetsService;
let loans: LoanService;
let jackpot: number;

const T0 = new Date('2026-08-19T10:00:00+07:00');
const later = (hours: number): Date => new Date(T0.getTime() + hours * 3_600_000);
const ME = 'debtor';

beforeEach(() => {
  db = createDb(':memory:');
  assets = new AssetsService(db);
  economy = new EconomyService(db, new BuffService(db), assets);
  jackpot = 0;
  loans = new LoanService(db, economy, assets, {
    addToJackpot: (amount) => {
      jackpot += amount;
    },
  });
  economy.ensureUser(ME);
});

describe('borrowing', () => {
  it('pays out and records the debt', () => {
    const before = economy.getBalance(ME);
    const result = loans.borrow(ME, 5_000, 0, null, null, T0);
    expect(result.ok).toBe(true);
    expect(economy.getBalance(ME)).toBe(before + 5_000);
    expect(loans.open(ME)?.principal).toBe(5_000);
  });

  it('allows only one loan at a time', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    expect(loans.borrow(ME, 1_000, 0, null, null, T0)).toMatchObject({
      ok: false,
      reason: 'has_loan',
    });
  });

  it('refuses amounts over the credit limit', () => {
    expect(loans.borrow(ME, 6_000, 0, null, null, T0)).toMatchObject({
      ok: false,
      reason: 'over_limit',
    });
  });

  it('refuses pocket change', () => {
    expect(loans.borrow(ME, LOAN_MIN - 1, 0, null, null, T0)).toMatchObject({
      ok: false,
      reason: 'too_small',
    });
  });

  it('lends more once the borrower owns property', () => {
    assets.add(ME, 'bietthu');
    expect(loans.limitFor(ME, 0)).toBeGreaterThan(loans.limitFor('someone-else', 0));
  });
});

describe('repaying', () => {
  it('takes principal plus interest and sends the interest to the jackpot', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.credit(ME, 10_000, 'test');
    const result = loans.repay(ME, later(1));
    expect(result).toMatchObject({ ok: true, paid: 6_000, interest: 1_000 });
    expect(loans.open(ME)).toBeNull();
    expect(jackpot).toBe(1_000);
  });

  it('reaches into the vault when the wallet is short', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.depositBank(ME, economy.getBalance(ME));
    expect(economy.getBalance(ME)).toBe(0);
    expect(loans.repay(ME, later(1)).ok).toBe(true);
    expect(loans.open(ME)).toBeNull();
  });

  it('refuses when wallet and vault together fall short', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.setBalance(ME, 0);
    expect(loans.repay(ME, later(1))).toMatchObject({ ok: false, reason: 'poor' });
    expect(loans.open(ME)).not.toBeNull();
  });

  it('charges the late penalty on an overdue loan', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.credit(ME, 50_000, 'test');
    const result = loans.repay(ME, later(27)); // 3 hours past the 24h term
    expect(result.paid).toBe(amountDue(5_000, later(24), later(27)));
    expect(result.paid).toBe(6_750);
  });
});

describe('the collector', () => {
  it('ignores loans still inside the grace period', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    expect(loans.defaulted(later(30))).toHaveLength(0);
  });

  it('picks up loans past the grace period', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    expect(loans.defaulted(later(49))).toHaveLength(1);
  });

  it('drains the wallet first, then the vault', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.setBalance(ME, 3_000);
    economy.credit(ME, 10_000, 'test');
    economy.depositBank(ME, 9_000);

    const [loan] = loans.defaulted(later(49));
    const result = loans.seize(loan, later(49));
    expect(result.steps).toContain('vi');
    expect(result.steps).toContain('ket');
    expect(result.recovered).toBe(result.owed);
    expect(result.jailedUntil).toBeNull();
    expect(loans.open(ME)).toBeNull();
  });

  it('sells the cheapest asset first and leaves the rest standing', () => {
    assets.add(ME, 'laudai');
    assets.add(ME, 'xemay');
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.setBalance(ME, 0);

    const [loan] = loans.defaulted(later(49));
    const result = loans.seize(loan, later(49));
    expect(result.soldAssets).toEqual(['xemay']);
    expect(assets.has(ME, 'laudai')).toBe(true);
    expect(result.recovered).toBeGreaterThanOrEqual(
      Math.floor(ASSETS.xemay.price * SEIZE_RATE),
    );
    expect(result.jailedUntil).toBeNull();
  });

  it('jails a debtor who has nothing left to take', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.setBalance(ME, 0);

    const [loan] = loans.defaulted(later(49));
    const result = loans.seize(loan, later(49));
    expect(result.steps).toContain('tu');
    expect(result.jailedUntil).not.toBeNull();
    expect(economy.jailedUntil(ME, later(49))).not.toBeNull();
    expect(loans.history(ME)).toMatchObject({ taken: 1, defaulted: 1 });
  });

  it('never hands the jackpot more than the interest it actually collected', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    economy.setBalance(ME, 0);
    const [loan] = loans.defaulted(later(49));
    loans.seize(loan, later(49));
    expect(jackpot).toBe(0);
  });
});

describe('dunning', () => {
  it('counts each shaming without touching a single coin', () => {
    loans.borrow(ME, 5_000, 0, null, null, T0);
    const balance = economy.getBalance(ME);
    expect(loans.recordDun(loans.open(ME)!.id)).toBe(1);
    expect(loans.recordDun(loans.open(ME)!.id)).toBe(2);
    expect(economy.getBalance(ME)).toBe(balance);
    expect(loans.open(ME)?.dunned).toBe(2);
  });
});
