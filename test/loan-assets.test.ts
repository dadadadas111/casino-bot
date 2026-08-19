import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  ASSET_LIST,
  DAILY_BONUS,
  SEIZE_RATE,
  WORK_COOLDOWN_MS,
  canBuy,
} from '../src/services/assets.service.js';
import {
  LOAN_BASE_LIMIT,
  LOAN_INTEREST,
  amountDue,
  creditLimit,
  overdueHours,
} from '../src/services/loan.service.js';
import { JOB_CREDIT } from '../src/services/job.service.js';

const hoursFromNow = (h: number): Date => new Date(Date.UTC(2026, 7, 19) + h * 3_600_000);
const T0 = hoursFromNow(0);

describe('asset catalogue', () => {
  it('prices every tier above the 1.000 xu shop so coins actually leave the vault', () => {
    for (const asset of ASSET_LIST) {
      expect(asset.price).toBeGreaterThanOrEqual(20_000);
    }
  });

  it('keeps each ladder strictly increasing in price and tier', () => {
    for (const kind of ['nha', 'xe'] as const) {
      const ladder = ASSET_LIST.filter((a) => a.kind === kind).sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i].price).toBeGreaterThan(ladder[i - 1].price);
      }
    }
  });

  it('gives every house a daily bonus and every vehicle a shorter cooldown', () => {
    for (const asset of ASSET_LIST) {
      if (asset.kind === 'nha') expect(DAILY_BONUS[asset.key]).toBeGreaterThan(0);
      if (asset.kind === 'xe') expect(WORK_COOLDOWN_MS[asset.key]).toBeLessThan(10 * 60_000);
    }
  });
});

describe('canBuy', () => {
  it('lets an empty-handed player buy anything', () => {
    const check = canBuy([], ASSETS.laudai);
    expect(check).toMatchObject({ ok: true, tradeIn: null, cost: ASSETS.laudai.price });
  });

  it('trades the old one in at half price when upgrading', () => {
    const check = canBuy([ASSETS.nhatro], ASSETS.nhapho);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.tradeIn?.key).toBe('nhatro');
    expect(check.cost).toBe(ASSETS.nhapho.price - ASSETS.nhatro.price * SEIZE_RATE);
  });

  it('refuses to sell what the player already owns', () => {
    expect(canBuy([ASSETS.oto], ASSETS.oto)).toEqual({ ok: false, reason: 'owned' });
  });

  it('refuses a downgrade instead of quietly taking the money', () => {
    expect(canBuy([ASSETS.sieuxe], ASSETS.xemay)).toEqual({ ok: false, reason: 'downgrade' });
  });

  it('treats the categories independently', () => {
    const check = canBuy([ASSETS.laudai], ASSETS.xemay);
    expect(check).toMatchObject({ ok: true, tradeIn: null });
  });
});

describe('loan maths', () => {
  it('charges the flat interest while still in term', () => {
    const due = hoursFromNow(24);
    expect(amountDue(10_000, due, T0)).toBe(10_000 * (1 + LOAN_INTEREST));
  });

  it('adds nothing for being early', () => {
    expect(overdueHours(hoursFromNow(5), T0)).toBe(0);
  });

  it('stacks the late penalty by the hour', () => {
    const due = hoursFromNow(0);
    expect(overdueHours(due, hoursFromNow(3))).toBe(3);
    // 20% interest + 3 * 5% penalty on the principal.
    expect(amountDue(10_000, due, hoursFromNow(3))).toBe(13_500);
  });

  it('never rounds a debt down in the debtor favour', () => {
    const owed = amountDue(1_001, hoursFromNow(0), hoursFromNow(1));
    expect(Number.isInteger(owed)).toBe(true);
    expect(owed).toBeGreaterThanOrEqual(1_001 * 1.25);
  });

  it('gives a tay-trắng player only the base limit', () => {
    expect(creditLimit(0, 0)).toBe(LOAN_BASE_LIMIT);
  });

  it('raises the limit with rank and with property', () => {
    expect(creditLimit(500, 0)).toBe(LOAN_BASE_LIMIT + JOB_CREDIT.chutich);
    expect(creditLimit(0, 100_000)).toBe(LOAN_BASE_LIMIT + 30_000);
    expect(creditLimit(500, 100_000)).toBe(LOAN_BASE_LIMIT + JOB_CREDIT.chutich + 30_000);
  });

  it('grows with every rung of the career ladder', () => {
    const limits = [0, 10, 30, 80, 200, 500].map((shifts) => creditLimit(shifts, 0));
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i]).toBeGreaterThan(limits[i - 1]);
    }
  });
});
