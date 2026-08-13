/**
 * Rules that keep admin powers honest. Pure logic, no Discord or DB imports,
 * so it can be unit tested without the bot environment.
 */

// Anti-inflation caps: admins juice the economy in small doses only.
// The set cap stays above what a single top-up exchange can produce so
// paying players are never capped below what they bought.
export const ADMIN_ADD_CAP = 10_000;
export const ADMIN_SET_CAP = 1_000_000;

/** Printing money is a crime; sometimes the police are watching. */
export const CHEAT_BUST_CHANCE = 0.35;

export function isCheatBusted(roll: number = Math.random()): boolean {
  return roll < CHEAT_BUST_CHANCE;
}
