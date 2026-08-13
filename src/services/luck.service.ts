import type { Db } from '../db/database.js';

/**
 * Hidden per-player luck. A favoured player who loses a round gets one silent
 * redo, with `factor` as the chance that redo happens (0 = untouched, 1 = the
 * house always gives a second draw).
 *
 * Only applied to games banked by the house. Player-versus-player games
 * (/keo, /coquay) and the shared lottery pot deliberately ignore luck, so a
 * favour never quietly drains another player's wallet.
 */
export class LuckService {
  constructor(private db: Db) {}

  get(userId: string): number {
    const row = this.db.prepare('SELECT factor FROM user_luck WHERE user_id = ?').get(userId) as
      | { factor: number }
      | undefined;
    return row?.factor ?? 0;
  }

  set(userId: string, factor: number): void {
    const clamped = Math.min(1, Math.max(0, factor));
    if (clamped === 0) {
      this.db.prepare('DELETE FROM user_luck WHERE user_id = ?').run(userId);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO user_luck (user_id, factor) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET factor = excluded.factor`,
      )
      .run(userId, clamped);
  }

  list(): Array<{ userId: string; factor: number }> {
    const rows = this.db
      .prepare('SELECT user_id, factor FROM user_luck ORDER BY factor DESC')
      .all() as Array<{ user_id: string; factor: number }>;
    return rows.map((r) => ({ userId: r.user_id, factor: r.factor }));
  }

  /** True when this losing round should be quietly replayed. */
  grantsRedo(userId: string, roll: number = Math.random()): boolean {
    const factor = this.get(userId);
    return factor > 0 && roll < factor;
  }

  /**
   * Play a house-banked round, replaying once for a favoured player who lost.
   * `play` must be side-effect free; it is called at most twice.
   */
  favor<T>(userId: string, play: () => T, isWin: (result: T) => boolean): T {
    const first = play();
    if (isWin(first) || !this.grantsRedo(userId)) return first;
    return play();
  }
}
