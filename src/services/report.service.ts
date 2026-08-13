import type { Db } from '../db/database.js';
import { vnDay } from './economy.service.js';
import { vnHour } from './lottery.service.js';

export interface ReportConfig {
  guildId: string;
  enabled: boolean;
  hour: number;
  channelId: string | null; // null = pick the busiest channel automatically
  tagEveryone: boolean;
  lastSentDay: string | null;
}

export interface GameStat {
  game: string;
  bets: number;
  staked: number;
}

export interface Mover {
  userId: string;
  net: number;
}

const DEFAULTS = { enabled: true, hour: 10, channelId: null, tagEveryone: true };

export class ReportService {
  constructor(private db: Db) {}

  getConfig(guildId: string): ReportConfig {
    const row = this.db
      .prepare('SELECT * FROM report_config WHERE guild_id = ?')
      .get(guildId) as
      | {
          guild_id: string;
          enabled: number;
          hour: number;
          channel_id: string | null;
          tag_everyone: number;
          last_sent_day: string | null;
        }
      | undefined;
    if (!row) return { guildId, ...DEFAULTS, lastSentDay: null };
    return {
      guildId,
      enabled: row.enabled === 1,
      hour: row.hour,
      channelId: row.channel_id,
      tagEveryone: row.tag_everyone === 1,
      lastSentDay: row.last_sent_day,
    };
  }

  updateConfig(
    guildId: string,
    patch: Partial<Pick<ReportConfig, 'enabled' | 'hour' | 'channelId' | 'tagEveryone'>>,
  ): ReportConfig {
    const current = this.getConfig(guildId);
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `INSERT INTO report_config (guild_id, enabled, hour, channel_id, tag_everyone, last_sent_day)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET
           enabled = excluded.enabled, hour = excluded.hour,
           channel_id = excluded.channel_id, tag_everyone = excluded.tag_everyone`,
      )
      .run(
        guildId,
        next.enabled ? 1 : 0,
        next.hour,
        next.channelId,
        next.tagEveryone ? 1 : 0,
        current.lastSentDay,
      );
    return next;
  }

  markSent(guildId: string, now: Date = new Date()): void {
    this.updateConfig(guildId, {}); // ensure the row exists
    this.db
      .prepare('UPDATE report_config SET last_sent_day = ? WHERE guild_id = ?')
      .run(vnDay(now), guildId);
  }

  /** Due when enabled, the configured hour has arrived, and not sent today. */
  isDue(guildId: string, now: Date = new Date()): boolean {
    const config = this.getConfig(guildId);
    return config.enabled && vnHour(now) >= config.hour && config.lastSentDay !== vnDay(now);
  }

  /** Richest players seen in this guild. */
  topUsers(guildId: string, limit: number): Array<{ userId: string; balance: number }> {
    const rows = this.db
      .prepare(
        `SELECT u.user_id, u.balance FROM users u
         JOIN user_guilds g ON g.user_id = u.user_id
         WHERE g.guild_id = ? ORDER BY u.balance DESC LIMIT ?`,
      )
      .all(guildId, limit) as Array<{ user_id: string; balance: number }>;
    return rows.map((r) => ({ userId: r.user_id, balance: r.balance }));
  }

  guildPlayerCount(guildId: string): number {
    return (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM user_guilds WHERE guild_id = ?')
        .get(guildId) as { n: number }
    ).n;
  }

  /** Bets per game over the last 24 hours (global economy). */
  gameStats24h(): GameStat[] {
    const rows = this.db
      .prepare(
        `SELECT meta AS game, COUNT(*) AS bets, SUM(-amount) AS staked FROM transactions
         WHERE type = 'bet' AND created_at >= datetime('now', '-1 day')
         GROUP BY meta ORDER BY bets DESC`,
      )
      .all() as Array<{ game: string; bets: number; staked: number }>;
    return rows;
  }

  /** Biggest gambling winner and loser of the last 24h among guild players. */
  topMovers24h(guildId: string): { winner: Mover | null; loser: Mover | null } {
    const rows = this.db
      .prepare(
        `SELECT t.user_id AS userId, SUM(t.amount) AS net FROM transactions t
         JOIN user_guilds g ON g.user_id = t.user_id AND g.guild_id = ?
         WHERE t.type IN ('bet', 'payout', 'refund')
           AND t.created_at >= datetime('now', '-1 day')
         GROUP BY t.user_id ORDER BY net DESC`,
      )
      .all(guildId) as Mover[];
    if (rows.length === 0) return { winner: null, loser: null };
    const winner = rows[0].net > 0 ? rows[0] : null;
    const last = rows[rows.length - 1];
    const loser = last.net < 0 ? last : null;
    return { winner, loser };
  }
}
