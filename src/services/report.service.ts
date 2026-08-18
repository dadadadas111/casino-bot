import type { Db } from '../db/database.js';
import { vnDay } from './economy.service.js';
import { vnHour } from './lottery.service.js';
import { GAME_LABELS } from '../embeds/history-table.js';

export interface ReportConfig {
  guildId: string;
  enabled: boolean;
  hour: number;
  channelId: string | null; // null = pick the busiest channel automatically
  tagEveryone: boolean;
  lastSentDay: string | null;
  patchEnabled: boolean;
  patchChannelId: string | null; // null = same auto-pick as the newsletter
  lastPatchVersion: string | null;
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

export interface PlayerProfile {
  userId: string;
  balance: number;
  gamesPlayed: number;
  streak: number;
  facts: string[]; // human-readable Vietnamese data points, most salient first
}

const DEFAULTS = {
  enabled: true,
  hour: 10,
  channelId: null,
  tagEveryone: false, // opt-in: a daily @everyone is a fast way to get a bot kicked
  patchEnabled: true,
  patchChannelId: null,
};

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
          patch_enabled: number;
          patch_channel_id: string | null;
          last_patch_version: string | null;
        }
      | undefined;
    if (!row) return { guildId, ...DEFAULTS, lastSentDay: null, lastPatchVersion: null };
    return {
      guildId,
      enabled: row.enabled === 1,
      hour: row.hour,
      channelId: row.channel_id,
      tagEveryone: row.tag_everyone === 1,
      lastSentDay: row.last_sent_day,
      patchEnabled: row.patch_enabled === 1,
      patchChannelId: row.patch_channel_id,
      lastPatchVersion: row.last_patch_version,
    };
  }

  updateConfig(
    guildId: string,
    patch: Partial<
      Pick<
        ReportConfig,
        'enabled' | 'hour' | 'channelId' | 'tagEveryone' | 'patchEnabled' | 'patchChannelId'
      >
    >,
  ): ReportConfig {
    const current = this.getConfig(guildId);
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `INSERT INTO report_config
           (guild_id, enabled, hour, channel_id, tag_everyone, last_sent_day,
            patch_enabled, patch_channel_id, last_patch_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET
           enabled = excluded.enabled, hour = excluded.hour,
           channel_id = excluded.channel_id, tag_everyone = excluded.tag_everyone,
           patch_enabled = excluded.patch_enabled, patch_channel_id = excluded.patch_channel_id`,
      )
      .run(
        guildId,
        next.enabled ? 1 : 0,
        next.hour,
        next.channelId,
        next.tagEveryone ? 1 : 0,
        current.lastSentDay,
        next.patchEnabled ? 1 : 0,
        next.patchChannelId,
        current.lastPatchVersion,
      );
    return next;
  }

  /** True when this guild has not been told about `version` yet. */
  patchDue(guildId: string, version: string): boolean {
    const config = this.getConfig(guildId);
    return config.patchEnabled && config.lastPatchVersion !== version;
  }

  markPatchSent(guildId: string, version: string): void {
    this.updateConfig(guildId, {}); // ensure the row exists
    this.db
      .prepare('UPDATE report_config SET last_patch_version = ? WHERE guild_id = ?')
      .run(version, guildId);
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

  /** Top players with the raw material for witty per-player commentary. */
  playerProfiles(guildId: string, limit: number, now: Date = new Date()): PlayerProfile[] {
    const fmt = (n: number): string => n.toLocaleString('vi-VN');
    const profiles = this.topUsers(guildId, limit).map(({ userId, balance }) => {
      const facts: string[] = [];

      const user = this.db
        .prepare(
          'SELECT daily_streak, total_won, total_lost, games_played, created_at FROM users WHERE user_id = ?',
        )
        .get(userId) as {
        daily_streak: number;
        total_won: number;
        total_lost: number;
        games_played: number;
        created_at: string;
      };

      const joinedDays = Math.floor(
        (now.getTime() - Date.parse(`${user.created_at.replace(' ', 'T')}Z`)) / 86_400_000,
      );
      facts.push(joinedDays <= 0 ? 'Mới tham gia hôm nay' : `Tham gia ${joinedDays} ngày trước`);
      facts.push(`Số dư ${fmt(balance)} xu, đã chơi ${user.games_played} ván`);

      const net = user.total_won - user.total_lost;
      facts.push(
        net === 0
          ? 'Cờ bạc đang hòa vốn'
          : net > 0
            ? `Tổng lời cờ bạc +${fmt(net)} xu`
            : `Tổng lỗ cờ bạc -${fmt(-net)} xu`,
      );

      // Admin money, broken down by operation.
      const adminRows = this.db
        .prepare(
          `SELECT type, COUNT(*) AS n, SUM(amount) AS s FROM transactions
           WHERE user_id = ? AND type IN ('admin_add', 'admin_set', 'admin_sub') GROUP BY type`,
        )
        .all(userId) as Array<{ type: string; n: number; s: number }>;
      for (const row of adminRows) {
        if (row.type === 'admin_add' && row.s > 0) {
          facts.push(`Được admin cộng ${row.n} lần, tổng ${fmt(row.s)} xu`);
        } else if (row.type === 'admin_set') {
          facts.push(`Được admin set thẳng số dư ${row.n} lần (${row.s >= 0 ? '+' : ''}${fmt(row.s)} xu)`);
        } else if (row.type === 'admin_sub') {
          facts.push(`Bị admin trừ ${fmt(-row.s)} xu`);
        }
      }

      // Per-game breakdown, top 3 by volume.
      const gameRows = this.db
        .prepare(
          `SELECT meta AS game,
             SUM(CASE WHEN type = 'bet' THEN 1 ELSE 0 END) AS bets,
             SUM(CASE WHEN type = 'bet' THEN -amount ELSE 0 END) AS staked,
             SUM(CASE WHEN type = 'payout' THEN amount ELSE 0 END) AS won,
             MAX(CASE WHEN type = 'payout' THEN amount ELSE 0 END) AS biggestWin
           FROM transactions
           WHERE user_id = ? AND meta IS NOT NULL AND type IN ('bet', 'payout')
           GROUP BY meta ORDER BY bets DESC, won DESC`,
        )
        .all(userId) as Array<{
        game: string;
        bets: number;
        staked: number;
        won: number;
        biggestWin: number;
      }>;
      for (const g of gameRows.slice(0, 3)) {
        const label = GAME_LABELS[g.game] ?? g.game;
        if (g.game === 'trieuphu') {
          facts.push(
            g.won > 0
              ? `Triệu phú: thắng tổng ${fmt(g.won)} xu${g.biggestWin >= 15_000 ? ', từng phá đảo cả 15 câu' : ''}`
              : 'Chơi Triệu phú nhưng chưa ăn giải nào',
          );
        } else if (g.bets > 0) {
          facts.push(`${label}: ${g.bets} lượt, cược ${fmt(g.staked)}, thắng về ${fmt(g.won)}`);
        }
      }

      if (user.daily_streak >= 2) {
        facts.push(`Streak điểm danh ${user.daily_streak} ngày liên tục`);
      }

      // Largest transfers, with counterparties as mention tokens.
      const transfers = this.db
        .prepare(
          `SELECT type, meta, SUM(amount) AS s FROM transactions
           WHERE user_id = ? AND type IN ('transfer_in', 'transfer_out') AND meta IS NOT NULL
           GROUP BY type, meta ORDER BY ABS(SUM(amount)) DESC LIMIT 2`,
        )
        .all(userId) as Array<{ type: string; meta: string; s: number }>;
      for (const t of transfers) {
        facts.push(
          t.type === 'transfer_in'
            ? `Được <@${t.meta}> chuyển cho ${fmt(t.s)} xu`
            : `Đã chuyển ${fmt(-t.s)} xu cho <@${t.meta}>`,
        );
      }

      return { userId, balance, gamesPlayed: user.games_played, streak: user.daily_streak, facts };
    });

    // Server-wide superlatives make "nhất server" comments possible.
    if (profiles.length > 1) {
      const mostGames = profiles.reduce((a, b) => (b.gamesPlayed > a.gamesPlayed ? b : a));
      if (mostGames.gamesPlayed >= 5) mostGames.facts.unshift('Chơi nhiều ván nhất server');
      const bestStreak = profiles.reduce((a, b) => (b.streak > a.streak ? b : a));
      if (bestStreak.streak >= 2) bestStreak.facts.unshift('Chăm điểm danh nhất server');
    }
    return profiles;
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
