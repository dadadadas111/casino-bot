import type { Db } from '../db/database.js';

export const STARTING_BALANCE = 1_000;
export const DAILY_BASE = 500;
export const DAILY_STREAK_BONUS = 100;
export const DAILY_STREAK_CAP = 5; // max bonus = 5 * 100

export interface Profile {
  userId: string;
  balance: number;
  dailyStreak: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  rank: number;
}

export interface DailyResult {
  ok: boolean;
  amount: number;
  streak: number;
  alreadyClaimed: boolean;
}

/** Calendar day in Vietnam timezone, e.g. "2026-08-09". */
export function vnDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export class EconomyService {
  constructor(private db: Db) {}

  ensureUser(userId: string): void {
    const inserted = this.db
      .prepare('INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, ?)')
      .run(userId, STARTING_BALANCE);
    if (inserted.changes > 0) {
      this.logTx(userId, STARTING_BALANCE, 'welcome', null);
    }
  }

  getBalance(userId: string): number {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT balance FROM users WHERE user_id = ?').get(userId) as
      | { balance: number }
      | undefined;
    return row?.balance ?? 0;
  }

  getProfile(userId: string): Profile {
    this.ensureUser(userId);
    const row = this.db
      .prepare(
        `SELECT balance, daily_streak, total_won, total_lost, games_played,
           (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.balance > u.balance) AS rank
         FROM users u WHERE user_id = ?`,
      )
      .get(userId) as {
      balance: number;
      daily_streak: number;
      total_won: number;
      total_lost: number;
      games_played: number;
      rank: number;
    };
    return {
      userId,
      balance: row.balance,
      dailyStreak: row.daily_streak,
      totalWon: row.total_won,
      totalLost: row.total_lost,
      gamesPlayed: row.games_played,
      rank: row.rank,
    };
  }

  /** Atomically remove coins. Returns false if the balance is insufficient. */
  debit(userId: string, amount: number, type: string, meta?: string): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    this.ensureUser(userId);
    const result = this.db
      .prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?')
      .run(amount, userId, amount);
    if (result.changes === 0) return false;
    this.logTx(userId, -amount, type, meta ?? null);
    return true;
  }

  credit(userId: string, amount: number, type: string, meta?: string): void {
    if (!Number.isInteger(amount) || amount <= 0) return;
    this.ensureUser(userId);
    this.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(amount, userId);
    this.logTx(userId, amount, type, meta ?? null);
  }

  setBalance(userId: string, amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) return;
    this.ensureUser(userId);
    this.db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(amount, userId);
    this.logTx(userId, amount, 'admin_set', null);
  }

  /** Returns false if the sender has insufficient balance. */
  transfer(fromId: string, toId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    this.ensureUser(fromId);
    this.ensureUser(toId);
    const run = this.db.transaction(() => {
      const debited = this.db
        .prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?')
        .run(amount, fromId, amount);
      if (debited.changes === 0) throw new Error('insufficient');
      this.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(amount, toId);
      this.logTx(fromId, -amount, 'transfer_out', toId);
      this.logTx(toId, amount, 'transfer_in', fromId);
    });
    try {
      run();
      return true;
    } catch {
      return false;
    }
  }

  /** One claim per Vietnam-timezone calendar day; consecutive days build a streak. */
  claimDaily(userId: string, now: Date = new Date()): DailyResult {
    this.ensureUser(userId);
    const today = vnDay(now);
    const yesterday = vnDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const row = this.db
      .prepare('SELECT last_daily, daily_streak FROM users WHERE user_id = ?')
      .get(userId) as { last_daily: string | null; daily_streak: number };

    if (row.last_daily === today) {
      return { ok: false, amount: 0, streak: row.daily_streak, alreadyClaimed: true };
    }

    const streak = row.last_daily === yesterday ? row.daily_streak + 1 : 1;
    const amount = DAILY_BASE + Math.min(streak - 1, DAILY_STREAK_CAP) * DAILY_STREAK_BONUS;
    this.db
      .prepare(
        'UPDATE users SET balance = balance + ?, last_daily = ?, daily_streak = ? WHERE user_id = ?',
      )
      .run(amount, today, streak, userId);
    this.logTx(userId, amount, 'daily', `streak:${streak}`);
    return { ok: true, amount, streak, alreadyClaimed: false };
  }

  /**
   * Settle a finished game. `bet` was already debited when the bet was placed;
   * `payout` is the total returned to the player (0 = lost, bet = push).
   */
  settleGame(userId: string, bet: number, payout: number, game: string): void {
    this.ensureUser(userId);
    const net = payout - bet;
    const run = this.db.transaction(() => {
      if (payout > 0) {
        this.db
          .prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
          .run(payout, userId);
        this.logTx(userId, payout, 'payout', game);
      }
      this.db
        .prepare(
          `UPDATE users SET games_played = games_played + 1,
             total_won = total_won + ?, total_lost = total_lost + ?
           WHERE user_id = ?`,
        )
        .run(net > 0 ? net : 0, net < 0 ? -net : 0, userId);
    });
    run();
  }

  topByBalance(limit: number): Array<{ userId: string; balance: number }> {
    const rows = this.db
      .prepare('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT ?')
      .all(limit) as Array<{ user_id: string; balance: number }>;
    return rows.map((r) => ({ userId: r.user_id, balance: r.balance }));
  }

  private logTx(userId: string, amount: number, type: string, meta: string | null): void {
    this.db
      .prepare('INSERT INTO transactions (user_id, amount, type, meta) VALUES (?, ?, ?, ?)')
      .run(userId, amount, type, meta);
  }
}
