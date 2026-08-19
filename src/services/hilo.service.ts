import { RANK_ORDER, type Card, type Rank, drawCard } from './cards.js';

/**
 * Hi-Lo: one card is face up, guess whether the next is higher or lower.
 * Every correct guess multiplies the stake and the player may walk away at
 * any time. The multiplier is derived from the true odds of the card on the
 * table, so a 2 pays almost nothing for "higher" and a fortune for "lower".
 */

export const HILO_EDGE = 0.97; // per guess, so a long streak costs a little more
export const HILO_MIN_MULTIPLIER = 1.05;
export const HILO_MAX_STEPS = 8;
export const HILO_MAX_TOTAL = 500;

export type HiLoChoice = 'cao' | 'thap';

/** Rank position 1..13, where A is 1 and K is 13. */
export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank) + 1;
}

/** How many of the 13 ranks beat / lose to this one. Ties are redrawn. */
export function outcomeCounts(rank: Rank): { cao: number; thap: number } {
  const v = rankValue(rank);
  return { cao: 13 - v, thap: v - 1 };
}

/** Null when the guess is impossible: nothing beats a K, nothing loses to an A. */
export function multiplierFor(rank: Rank, choice: HiLoChoice): number | null {
  const counts = outcomeCounts(rank);
  const winning = counts[choice];
  if (winning === 0) return null;
  // 12 non-tie ranks are in play; ties are thrown back.
  const raw = (HILO_EDGE * 12) / winning;
  return Math.max(HILO_MIN_MULTIPLIER, Math.round(raw * 100) / 100);
}

export function isCorrect(current: Rank, next: Rank, choice: HiLoChoice): boolean {
  const a = rankValue(current);
  const b = rankValue(next);
  return choice === 'cao' ? b > a : b < a;
}

/** Draw a card that is not a tie with the one on the table. */
export function drawDifferent(current: Rank, rng: () => number = Math.random): Card {
  let card = drawCard(rng);
  while (card.rank === current) card = drawCard(rng);
  return card;
}

export function cappedTotal(total: number): number {
  return Math.min(total, HILO_MAX_TOTAL);
}
