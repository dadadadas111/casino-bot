/**
 * Coffee (☕) clears the work cooldown, which invites a buy-coffee-work-repeat
 * loop that outruns the ten-minute timer entirely. The throttle is thematic:
 * too much caffeine in one sitting risks an overdose that lands you in the
 * hospital. A light user drinking a cup or two is never at risk. Pure logic.
 */

export const CAFFEINE_WINDOW_MS = 60 * 60 * 1000; // one hour, rolling
export const SAFE_CUPS = 3; // free every window
export const OVERDOSE_STEP = 0.2; // added risk per cup past the safe count
export const OVERDOSE_CAP = 0.85;
/** An overdose is a shorter stay than a gunshot, but still blocks play. */
export const HOSPITAL_OVERDOSE_MS = 3 * 60 * 1000;

/**
 * Overdose chance for the cup being drunk now, where `cups` counts it. The
 * first SAFE_CUPS are free; each one after adds OVERDOSE_STEP up to the cap.
 */
export function overdoseChance(cups: number): number {
  if (cups <= SAFE_CUPS) return 0;
  return Math.min(OVERDOSE_CAP, (cups - SAFE_CUPS) * OVERDOSE_STEP);
}

/** True when the previous cup was long enough ago to reset the tally. */
export function windowExpired(lastAt: string | null, now: Date): boolean {
  return !lastAt || now.getTime() - Date.parse(lastAt) > CAFFEINE_WINDOW_MS;
}
