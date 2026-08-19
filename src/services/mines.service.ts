/**
 * Dò mìn: a grid of tiles hiding a handful of mines. Every safe tile grows
 * the multiplier, and the player can cash out after any reveal. Stepping on
 * a mine loses the lot.
 */

export const MINES_TILES = 16;
export const MINES_COUNT = 3;
export const MINES_EDGE = 0.96;
export const MINES_SAFE = MINES_TILES - MINES_COUNT;

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

/**
 * Payout multiplier after `revealed` safe tiles. Derived from the odds of
 * getting that far: C(tiles, k) / C(safe, k), trimmed by the house edge.
 */
export function multiplierAfter(revealed: number): number {
  if (revealed <= 0) return 1;
  const odds = combinations(MINES_TILES, revealed) / combinations(MINES_SAFE, revealed);
  return Math.round(MINES_EDGE * odds * 100) / 100;
}

/** Pick which tiles are mined. Fisher-Yates over the tile indices. */
export function layMines(rng: () => number = Math.random): number[] {
  const tiles = Array.from({ length: MINES_TILES }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, MINES_COUNT).sort((a, b) => a - b);
}
