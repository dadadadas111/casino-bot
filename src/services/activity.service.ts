import type { Db } from '../db/database.js';
import { vnDay } from './economy.service.js';

const CHANNEL_WINDOW_DAYS = 7;
const PRUNE_AFTER_DAYS = 30;

/** Tracks who plays in which guild and which channels are busiest. */
export class ActivityService {
  constructor(private db: Db) {}

  recordUser(guildId: string, userId: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO user_guilds (user_id, guild_id, last_seen) VALUES (?, ?, ?)
         ON CONFLICT(user_id, guild_id) DO UPDATE SET last_seen = excluded.last_seen`,
      )
      .run(userId, guildId, now.toISOString());
  }

  recordChannel(guildId: string, channelId: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO channel_activity (guild_id, channel_id, day, n) VALUES (?, ?, ?, 1)
         ON CONFLICT(guild_id, channel_id, day) DO UPDATE SET n = n + 1`,
      )
      .run(guildId, channelId, vnDay(now));
  }

  /** Busiest channel over the recent window, or null when nothing was seen. */
  topChannel(guildId: string, now: Date = new Date()): string | null {
    const cutoff = vnDay(new Date(now.getTime() - CHANNEL_WINDOW_DAYS * 24 * 60 * 60 * 1000));
    const row = this.db
      .prepare(
        `SELECT channel_id, SUM(n) AS total FROM channel_activity
         WHERE guild_id = ? AND day >= ?
         GROUP BY channel_id ORDER BY total DESC LIMIT 1`,
      )
      .get(guildId, cutoff) as { channel_id: string } | undefined;
    return row?.channel_id ?? null;
  }

  pruneOldChannelActivity(now: Date = new Date()): void {
    const cutoff = vnDay(new Date(now.getTime() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000));
    this.db.prepare('DELETE FROM channel_activity WHERE day < ?').run(cutoff);
  }
}
