/**
 * Lightweight in-memory per-user cooldowns for spam control. Short windows
 * only; anything that must survive a restart (e.g. /lamviec's hourly limit)
 * belongs in the database instead.
 */
const active = new Map<string, number>();

/** Returns 0 when allowed (and starts the cooldown), else the remaining ms. */
export function tryUse(userId: string, key: string, durationMs: number, now = Date.now()): number {
  const mapKey = `${key}:${userId}`;
  const expiresAt = active.get(mapKey);
  if (expiresAt !== undefined && expiresAt > now) {
    return expiresAt - now;
  }
  active.set(mapKey, now + durationMs);
  return 0;
}
