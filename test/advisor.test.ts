import { describe, expect, it } from 'vitest';
import { EXPOSED_WALLET, LOAN_SOON_HOURS, recommend, type AdvisorState } from '../src/services/advisor.service.js';

const base: AdvisorState = {
  jailed: false, jailFee: 1000,
  hospitalized: false, hospitalFee: 1000,
  hasKey: false,
  loanOverdue: false, loanDueSoonHours: null, loanOwed: 0,
  canDaily: false, workReady: false, isChutich: false, quizReady: false,
  wallet: 500, bank: 0, cash: 0, jackpot: 1_000_000, quest: null,
};
const keys = (s: AdvisorState) => recommend(s).map((a) => a.key);

describe('advisor', () => {
  it('always returns at least one suggestion', () => {
    expect(recommend(base).length).toBeGreaterThan(0);
    expect(keys(base)).toEqual(['play']); // nothing pressing -> go play
  });

  it('puts confinement first, above income', () => {
    const s = { ...base, jailed: true, canDaily: true, workReady: true };
    expect(keys(s)[0]).toBe('jail');
  });

  it('suggests the key when the player has one, else paying', () => {
    expect(recommend({ ...base, jailed: true, hasKey: true })[0].detail).toContain('chìa khóa');
    expect(recommend({ ...base, jailed: true, hasKey: false })[0].detail).toContain('Nộp phạt');
  });

  it('flags an overdue loan above ready income', () => {
    const s = { ...base, loanOverdue: true, loanOwed: 5000, canDaily: true };
    expect(keys(s)[0]).toBe('loan_overdue');
  });

  it('warns about a loan only when it is close to due', () => {
    expect(keys({ ...base, loanDueSoonHours: LOAN_SOON_HOURS, loanOwed: 5000 })).toContain('loan_soon');
    expect(keys({ ...base, loanDueSoonHours: LOAN_SOON_HOURS + 5, loanOwed: 5000 })).not.toContain('loan_soon');
  });

  it('recommends every ready income source', () => {
    const s = { ...base, canDaily: true, quizReady: true, workReady: true };
    const k = keys(s);
    expect(k).toContain('daily');
    expect(k).toContain('quiz');
    expect(k).toContain('work');
  });

  it('tailors the work suggestion for a Chủ tịch', () => {
    const normal = recommend({ ...base, workReady: true }).find((a) => a.key === 'work');
    const ceo = recommend({ ...base, workReady: true, isChutich: true }).find((a) => a.key === 'work');
    expect(normal?.detail).toContain('lên chức');
    expect(ceo?.detail).toContain('Chủ tịch');
  });

  it('tells a cash-heavy wallet to bank the excess', () => {
    expect(keys({ ...base, wallet: EXPOSED_WALLET + 1 })).toContain('bank');
    expect(keys({ ...base, wallet: EXPOSED_WALLET })).not.toContain('bank');
  });

  it('suggests exchanging unspent top-up cash', () => {
    expect(keys({ ...base, cash: 5000 })).toContain('exchange');
    expect(keys({ ...base, cash: 0 })).not.toContain('exchange');
  });

  it('keeps confinement, then debt, then income, then housekeeping order', () => {
    const s: AdvisorState = {
      ...base, jailed: true, loanOverdue: true, loanOwed: 5000,
      canDaily: true, wallet: 50_000,
    };
    const k = keys(s);
    expect(k.indexOf('jail')).toBeLessThan(k.indexOf('loan_overdue'));
    expect(k.indexOf('loan_overdue')).toBeLessThan(k.indexOf('daily'));
    expect(k.indexOf('daily')).toBeLessThan(k.indexOf('bank'));
  });
});
