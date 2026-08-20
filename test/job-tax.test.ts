import { describe, expect, it } from 'vitest';
import {
  JOB_CREDIT,
  JOB_RANKS,
  isPromotion,
  nextRank,
  rankFor,
  shiftsToNext,
} from '../src/services/job.service.js';
import { TAX_BRACKETS, marginalRate, taxOn, taxOnWage } from '../src/services/tax.service.js';

describe('job ladder', () => {
  it('starts everyone at the bottom rung', () => {
    expect(rankFor(0).key).toBe('chayvat');
    expect(rankFor(9).key).toBe('chayvat');
  });

  it('promotes exactly on the threshold shift', () => {
    expect(rankFor(10).key).toBe('phuho');
    expect(rankFor(30).key).toBe('nhanvien');
    expect(rankFor(80).key).toBe('truongphong');
    expect(rankFor(200).key).toBe('giamdoc');
    expect(rankFor(500).key).toBe('chutich');
  });

  it('stays at the top once there', () => {
    expect(rankFor(10_000).key).toBe('chutich');
    expect(nextRank(10_000)).toBeNull();
    expect(shiftsToNext(10_000)).toBe(0);
  });

  it('flags the single shift that earns a promotion', () => {
    expect(isPromotion(9)).toBe(true); // the 10th shift
    expect(isPromotion(8)).toBe(false);
    expect(isPromotion(29)).toBe(true);
  });

  it('counts down to the next rank', () => {
    expect(shiftsToNext(0)).toBe(10);
    expect(shiftsToNext(7)).toBe(3);
  });

  it('never pays less at a higher rank', () => {
    for (let i = 1; i < JOB_RANKS.length; i++) {
      expect(JOB_RANKS[i].min).toBeGreaterThan(JOB_RANKS[i - 1].min);
      expect(JOB_RANKS[i].max).toBeGreaterThan(JOB_RANKS[i - 1].max);
      expect(JOB_RANKS[i].from).toBeGreaterThan(JOB_RANKS[i - 1].from);
    }
  });

  it('gives every rank a credit allowance', () => {
    for (const rank of JOB_RANKS) {
      expect(JOB_CREDIT[rank.key]).toBeTypeOf('number');
    }
  });
});

describe('income tax', () => {
  it('leaves an ordinary day of play untouched', () => {
    // The heaviest grinder measured earned ~20.000 in a day; all of that,
    // and then some, sits inside the free bracket now.
    expect(taxOn(400)).toBe(0);
    expect(taxOn(20_000)).toBe(0);
    expect(taxOn(40_000)).toBe(0);
  });

  it('charges only the slice inside each bracket', () => {
    // 40.000 free, then 10.000 at 15%.
    expect(taxOn(50_000)).toBe(1_500);
    // ...the full 15% band, then 50.000 at 35%.
    expect(taxOn(150_000)).toBe(9_000 + 17_500);
  });

  it('bites at scripting volumes but stays gentler than the old table', () => {
    const owed = taxOn(500_000);
    // Under half, where the old table took nearly three quarters.
    expect(owed / 500_000).toBeGreaterThan(0.35);
    expect(owed / 500_000).toBeLessThan(0.5);
  });

  it('splits a wage the same way no matter how it arrives', () => {
    const oneGo = taxOn(120_000);
    let piecemeal = 0;
    let earned = 0;
    for (let i = 0; i < 120; i++) {
      piecemeal += taxOnWage(earned, 1_000);
      earned += 1_000;
    }
    expect(piecemeal).toBe(oneGo);
  });

  it('rises monotonically with income', () => {
    let previous = -1;
    for (let income = 0; income <= 400_000; income += 2_500) {
      const owed = taxOn(income);
      expect(owed).toBeGreaterThanOrEqual(previous);
      previous = owed;
    }
  });

  it('reports the bracket the player is standing on', () => {
    expect(marginalRate(0)).toBe(0);
    expect(marginalRate(20_000)).toBe(0); // a full day of hand-play is free
    expect(marginalRate(50_000)).toBe(0.15);
    expect(marginalRate(999_999)).toBe(TAX_BRACKETS[TAX_BRACKETS.length - 1].rate);
  });

  it('ignores nonsense input instead of inventing a refund', () => {
    expect(taxOn(0)).toBe(0);
    expect(taxOn(-5_000)).toBe(0);
  });
});
