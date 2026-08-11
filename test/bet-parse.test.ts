import { describe, expect, it } from 'vitest';
import { extractBetAndChoice, parseBetToken } from '../src/services/bet-parse';

describe('parseBetToken', () => {
  it('parses plain and separator-formatted numbers', () => {
    expect(parseBetToken('500', 0)).toBe(500);
    expect(parseBetToken('1.000', 0)).toBe(1_000);
    expect(parseBetToken('1,000', 0)).toBe(1_000);
  });

  it('parses k/m shorthand including 1k5', () => {
    expect(parseBetToken('1k', 0)).toBe(1_000);
    expect(parseBetToken('1k5', 0)).toBe(1_500);
    expect(parseBetToken('25K', 0)).toBe(25_000);
    expect(parseBetToken('2m', 0)).toBe(2_000_000);
  });

  it('resolves all and half against the balance', () => {
    expect(parseBetToken('all', 12_345)).toBe(12_345);
    expect(parseBetToken('half', 1_001)).toBe(500);
    expect(parseBetToken('nua', 800)).toBe(400);
  });

  it('rejects non-bet tokens', () => {
    expect(parseBetToken('tai', 100)).toBeNull();
    expect(parseBetToken('k5', 100)).toBeNull();
    expect(parseBetToken('', 100)).toBeNull();
  });
});

describe('extractBetAndChoice', () => {
  const choices = { tai: 'tai', t: 'tai', xiu: 'xiu', x: 'xiu' } as const;

  it('accepts bet and choice in any order', () => {
    expect(extractBetAndChoice(['100', 'tai'], choices, 0)).toEqual({ bet: 100, choice: 'tai' });
    expect(extractBetAndChoice(['tai', '100'], choices, 0)).toEqual({ bet: 100, choice: 'tai' });
  });

  it('supports single-letter choices and shorthand bets together', () => {
    expect(extractBetAndChoice(['x', '1k5'], choices, 0)).toEqual({ bet: 1_500, choice: 'xiu' });
    expect(extractBetAndChoice(['all', 't'], choices, 5_000)).toEqual({
      bet: 5_000,
      choice: 'tai',
    });
  });

  it('returns nulls for whatever is missing', () => {
    expect(extractBetAndChoice(['tai'], choices, 0)).toEqual({ bet: null, choice: 'tai' });
    expect(extractBetAndChoice(['100'], choices, 0)).toEqual({ bet: 100, choice: null });
    expect(extractBetAndChoice([], choices, 0)).toEqual({ bet: null, choice: null });
  });
});
