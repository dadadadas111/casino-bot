/**
 * Multiplayer Russian roulette: one bullet, six chambers, players take turns.
 * The first player hit loses their ante and goes to hospital; survivors split
 * what the victim put in. Player versus player, so the house takes no rake.
 */
export const CHAMBERS = 6;
export const MIN_PLAYERS = 2;

export interface Pull {
  player: number; // index into the player list
  died: boolean;
}

export interface RoundResult {
  victimIndex: number;
  pulls: Pull[];
}

/** Chance the next pull is fatal once `fired` chambers have been spent. */
export function deathChance(fired: number): number {
  return 1 / (CHAMBERS - fired);
}

/**
 * Resolve one full round. Always terminates: the last chamber is a certainty,
 * so somebody is always hit within CHAMBERS pulls.
 */
export function simulateRound(playerCount: number, rng: () => number = Math.random): RoundResult {
  const pulls: Pull[] = [];
  for (let fired = 0; fired < CHAMBERS; fired++) {
    const player = fired % playerCount;
    const died = rng() < deathChance(fired);
    pulls.push({ player, died });
    if (died) return { victimIndex: player, pulls };
  }
  const last = pulls[pulls.length - 1];
  return { victimIndex: last.player, pulls };
}

/** Each survivor's cut of the victim's ante (remainder stays unpaid). */
export function survivorShare(bet: number, survivorCount: number): number {
  if (survivorCount <= 0) return 0;
  return Math.floor(bet / survivorCount);
}
