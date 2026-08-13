import type { Db } from '../db/database.js';

/** Read-only aggregates powering the admin dashboard. */
export class DashboardService {
  constructor(private db: Db) {}

  overview(): Record<string, number> {
    const one = <T>(sql: string): T => this.db.prepare(sql).get() as T;
    const users = one<{ n: number; wallet: number; bank: number; cash: number }>(
      'SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS wallet, COALESCE(SUM(bank_balance),0) AS bank, COALESCE(SUM(cash),0) AS cash FROM users',
    );
    const day = one<{ bets: number; staked: number; payout: number }>(
      `SELECT
         SUM(CASE WHEN type='bet' THEN 1 ELSE 0 END) AS bets,
         COALESCE(SUM(CASE WHEN type='bet' THEN -amount ELSE 0 END),0) AS staked,
         COALESCE(SUM(CASE WHEN type='payout' THEN amount ELSE 0 END),0) AS payout
       FROM transactions WHERE created_at >= datetime('now','-1 day')`,
    );
    const revenue = one<{ total: number }>(
      "SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE type='topup'",
    );
    const jackpot = one<{ value: string } | undefined>(
      "SELECT value FROM lottery_meta WHERE key='jackpot'",
    );
    const active = one<{ n: number }>(
      "SELECT COUNT(DISTINCT user_id) AS n FROM transactions WHERE created_at >= datetime('now','-1 day')",
    );
    const guilds = one<{ n: number }>('SELECT COUNT(DISTINCT guild_id) AS n FROM user_guilds');

    return {
      players: users.n,
      wallet: users.wallet,
      bank: users.bank,
      cashHeld: users.cash,
      revenueVnd: revenue.total,
      bets24h: day.bets ?? 0,
      staked24h: day.staked,
      payout24h: day.payout,
      activePlayers24h: active.n,
      guilds: guilds.n,
      jackpot: Number(jackpot?.value ?? 0),
    };
  }

  players(limit = 100): unknown[] {
    return this.db
      .prepare(
        `SELECT user_id AS userId, balance, bank_balance AS bank, cash, games_played AS games,
                total_won AS won, total_lost AS lost, daily_streak AS streak,
                jail_until AS jailUntil, hospital_until AS hospitalUntil, created_at AS joined
         FROM users ORDER BY balance + bank_balance DESC LIMIT ?`,
      )
      .all(limit);
  }

  transactions(limit = 100): unknown[] {
    return this.db
      .prepare(
        'SELECT id, user_id AS userId, amount, type, meta, created_at AS at FROM transactions ORDER BY id DESC LIMIT ?',
      )
      .all(limit);
  }

  topups(limit = 50): unknown[] {
    return this.db
      .prepare(
        `SELECT s.id, s.user_id AS userId, s.amount, s.content, s.matched_code AS code, s.created_at AS at
         FROM sepay_transactions s ORDER BY s.rowid DESC LIMIT ?`,
      )
      .all(limit);
  }

  /** Per-game volume and realised return-to-player. */
  games(): unknown[] {
    return this.db
      .prepare(
        `SELECT meta AS game,
                SUM(CASE WHEN type='bet' THEN 1 ELSE 0 END) AS bets,
                COALESCE(SUM(CASE WHEN type='bet' THEN -amount ELSE 0 END),0) AS staked,
                COALESCE(SUM(CASE WHEN type='payout' THEN amount ELSE 0 END),0) AS paid
         FROM transactions
         WHERE meta IS NOT NULL AND type IN ('bet','payout')
         GROUP BY meta ORDER BY bets DESC`,
      )
      .all();
  }

  guilds(): unknown[] {
    return this.db
      .prepare(
        `SELECT g.guild_id AS guildId, COUNT(*) AS players,
                c.enabled AS reportEnabled, c.hour, c.channel_id AS channelId,
                c.tag_everyone AS tagEveryone, c.last_patch_version AS patchVersion
         FROM user_guilds g
         LEFT JOIN report_config c ON c.guild_id = g.guild_id
         GROUP BY g.guild_id ORDER BY players DESC`,
      )
      .all();
  }
}
