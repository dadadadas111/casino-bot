/**
 * Progressive income tax on wages. Undocumented on purpose: nothing in /help
 * mentions it, players discover it by out-earning the first bracket. The
 * numbers still add up on screen, so it reads as a rule of the world rather
 * than a bug.
 *
 * Brackets apply to the rolling 24h wage total, so casual players never pay
 * and grinders throttle themselves. Pure logic, no DB.
 */

export interface TaxBracket {
  /** Upper bound of this bracket's income, exclusive. */
  upTo: number;
  rate: number;
}

export const TAX_BRACKETS: TaxBracket[] = [
  { upTo: 5_000, rate: 0 },
  { upTo: 15_000, rate: 0.1 },
  { upTo: 40_000, rate: 0.25 },
  { upTo: 100_000, rate: 0.55 },
  { upTo: Infinity, rate: 0.8 },
];

/** Total tax owed on a rolling income of `income`. */
export function taxOn(income: number): number {
  if (income <= 0) return 0;
  let owed = 0;
  let floor = 0;
  for (const bracket of TAX_BRACKETS) {
    const inBracket = Math.min(income, bracket.upTo) - floor;
    if (inBracket <= 0) break;
    owed += inBracket * bracket.rate;
    floor = bracket.upTo;
  }
  return Math.round(owed);
}

/**
 * Tax on one new wage payment, given what the player already earned in the
 * window. Charging the difference keeps the ladder consistent no matter how
 * the income is split across shifts.
 */
export function taxOnWage(earnedSoFar: number, wage: number): number {
  return taxOn(earnedSoFar + wage) - taxOn(earnedSoFar);
}

/** The marginal rate the player is standing on, for the nudge message. */
export function marginalRate(income: number): number {
  for (const bracket of TAX_BRACKETS) {
    if (income < bracket.upTo) return bracket.rate;
  }
  return TAX_BRACKETS[TAX_BRACKETS.length - 1].rate;
}
