import type { Db } from '../db/database.js';
import { BuffService, LUCKY_BONUS_RATE } from './buff.service.js';

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

export const WORK_COOLDOWN_MS = 60 * 60 * 1000;
export const WORK_MIN = 100;
export const WORK_MAX = 300;

export const ROB_COOLDOWN_MS = 60 * 60 * 1000;
export const ROB_SUCCESS_RATE = 0.4;
export const ROB_TAKE_RATE = 0.15;
export const ROB_MIN_VICTIM_WALLET = 500;
export const ROB_TAKE_CAP = 10_000;
export const JAIL_MINUTES = 30;
export const BAIL_COST = 2_000;
export const DIVORCE_FEE = 1_000;

export type RobOutcome =
  | { result: 'cooldown'; retryAt: Date }
  | { result: 'victim_poor' }
  | { result: 'success'; amount: number }
  | { result: 'jailed'; releaseAt: Date };

export interface WorkResult {
  ok: boolean;
  amount: number;
  retryAt: Date;
}

export interface HistoryEntry {
  amount: number;
  type: string;
  meta: string | null;
  createdAt: string; // UTC "YYYY-MM-DD HH:MM:SS" from SQLite datetime('now')
  balanceAfter: number;
}

/** Calendar day in Vietnam timezone, e.g. "2026-08-09". */
export function vnDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export class EconomyService {
  constructor(
    private db: Db,
    private buffs: BuffService = new BuffService(db),
  ) {}

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
    const old = this.getBalance(userId);
    this.db.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(amount, userId);
    // Log the delta, not the absolute value, so history can walk balances back.
    this.logTx(userId, amount - old, 'admin_set', null);
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
   * Admin tool: clear a user's long cooldowns. Resetting daily sets
   * last_daily to yesterday so an immediate re-claim CONTINUES the streak
   * instead of restarting it.
   */
  resetCooldown(userId: string, kind: 'daily' | 'work' | 'trieuphu' | 'all', now: Date = new Date()): void {
    this.ensureUser(userId);
    const yesterday = vnDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    if (kind === 'daily' || kind === 'all') {
      this.db.prepare('UPDATE users SET last_daily = ? WHERE user_id = ?').run(yesterday, userId);
    }
    if (kind === 'work' || kind === 'all') {
      this.db.prepare('UPDATE users SET last_work = NULL WHERE user_id = ?').run(userId);
    }
    if (kind === 'trieuphu' || kind === 'all') {
      this.db.prepare('UPDATE users SET last_trieuphu = NULL WHERE user_id = ?').run(userId);
    }
  }

  /** One quiz game per Vietnam-timezone calendar day. */
  canPlayQuiz(userId: string, now: Date = new Date()): boolean {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT last_trieuphu FROM users WHERE user_id = ?').get(userId) as {
      last_trieuphu: string | null;
    };
    return row.last_trieuphu !== vnDay(now);
  }

  markQuizPlayed(userId: string, now: Date = new Date()): void {
    this.ensureUser(userId);
    this.db
      .prepare('UPDATE users SET last_trieuphu = ? WHERE user_id = ?')
      .run(vnDay(now), userId);
  }

  /** Earn a random wage once per hour; the cooldown is persisted in the DB. */
  work(userId: string, now: Date = new Date()): WorkResult {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT last_work FROM users WHERE user_id = ?').get(userId) as {
      last_work: string | null;
    };
    if (row.last_work) {
      const readyAt = new Date(Date.parse(row.last_work) + WORK_COOLDOWN_MS);
      if (readyAt.getTime() > now.getTime()) {
        return { ok: false, amount: 0, retryAt: readyAt };
      }
    }
    const steps = (WORK_MAX - WORK_MIN) / 10 + 1;
    const amount = WORK_MIN + 10 * Math.floor(Math.random() * steps);
    this.db
      .prepare('UPDATE users SET balance = balance + ?, last_work = ? WHERE user_id = ?')
      .run(amount, now.toISOString(), userId);
    this.logTx(userId, amount, 'work', null);
    return { ok: true, amount, retryAt: new Date(now.getTime() + WORK_COOLDOWN_MS) };
  }

  /**
   * Settle a finished game. `bet` was already debited when the bet was placed;
   * `payout` is the total returned to the player (0 = lost, bet = push).
   */
  settleGame(userId: string, bet: number, payout: number, game: string, now: Date = new Date()): void {
    this.ensureUser(userId);
    const net = payout - bet;
    // The lucky charm tops up winnings only, never softens a loss.
    const bonus =
      net > 0 && this.buffs.activeUntil(userId, 'mayman', now)
        ? Math.floor(net * LUCKY_BONUS_RATE)
        : 0;
    const run = this.db.transaction(() => {
      if (payout > 0) {
        this.db
          .prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
          .run(payout, userId);
        this.logTx(userId, payout, 'payout', game);
      }
      if (bonus > 0) {
        this.db
          .prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
          .run(bonus, userId);
        this.logTx(userId, bonus, 'buff_bonus', game);
      }
      this.db
        .prepare(
          `UPDATE users SET games_played = games_played + 1,
             total_won = total_won + ?, total_lost = total_lost + ?
           WHERE user_id = ?`,
        )
        .run(net > 0 ? net + bonus : 0, net < 0 ? -net : 0, userId);
    });
    run();
  }

  /**
   * Latest transactions, newest first, each annotated with the balance right
   * after it. Every balance change writes exactly one delta row, so walking
   * backwards from the current balance reconstructs the running balance.
   */
  getHistory(userId: string, limit: number): { entries: HistoryEntry[]; total: number } {
    this.ensureUser(userId);
    const total = (
      this.db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(userId) as {
        n: number;
      }
    ).n;
    const rows = this.db
      .prepare(
        'SELECT amount, type, meta, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(userId, limit) as Array<{
      amount: number;
      type: string;
      meta: string | null;
      created_at: string;
    }>;
    let balance = this.getBalance(userId);
    const entries: HistoryEntry[] = rows.map((row) => {
      const entry: HistoryEntry = {
        amount: row.amount,
        type: row.type,
        meta: row.meta,
        createdAt: row.created_at,
        balanceAfter: balance,
      };
      balance -= row.amount;
      return entry;
    });
    return { entries, total };
  }

  // ---- Bank: money in the vault is safe from thieves ----

  getBank(userId: string): number {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT bank_balance FROM users WHERE user_id = ?').get(userId) as {
      bank_balance: number;
    };
    return row.bank_balance;
  }

  depositBank(userId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    this.ensureUser(userId);
    const run = this.db.transaction(() => {
      const debited = this.db
        .prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?')
        .run(amount, userId, amount);
      if (debited.changes === 0) throw new Error('insufficient');
      this.db
        .prepare('UPDATE users SET bank_balance = bank_balance + ? WHERE user_id = ?')
        .run(amount, userId);
      this.logTx(userId, -amount, 'bank_in', null);
    });
    try {
      run();
      return true;
    } catch {
      return false;
    }
  }

  withdrawBank(userId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    this.ensureUser(userId);
    const run = this.db.transaction(() => {
      const taken = this.db
        .prepare(
          'UPDATE users SET bank_balance = bank_balance - ? WHERE user_id = ? AND bank_balance >= ?',
        )
        .run(amount, userId, amount);
      if (taken.changes === 0) throw new Error('insufficient');
      this.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(amount, userId);
      this.logTx(userId, amount, 'bank_out', null);
    });
    try {
      run();
      return true;
    } catch {
      return false;
    }
  }

  // ---- Jail ----

  /** Release time when jailed, else null. */
  jailedUntil(userId: string, now: Date = new Date()): Date | null {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT jail_until FROM users WHERE user_id = ?').get(userId) as {
      jail_until: string | null;
    };
    if (!row.jail_until) return null;
    const until = new Date(row.jail_until);
    return until.getTime() > now.getTime() ? until : null;
  }

  jail(userId: string, minutes: number, now: Date = new Date()): Date {
    this.ensureUser(userId);
    const until = new Date(now.getTime() + minutes * 60 * 1000);
    this.db
      .prepare('UPDATE users SET jail_until = ? WHERE user_id = ?')
      .run(until.toISOString(), userId);
    return until;
  }

  /** Free someone without charging bail (used by the skeleton key item). */
  release(userId: string): void {
    this.db.prepare('UPDATE users SET jail_until = NULL WHERE user_id = ?').run(userId);
  }

  bail(userId: string, now: Date = new Date()): 'ok' | 'not_jailed' | 'poor' {
    if (!this.jailedUntil(userId, now)) return 'not_jailed';
    if (!this.debit(userId, BAIL_COST, 'bail')) return 'poor';
    this.db.prepare('UPDATE users SET jail_until = NULL WHERE user_id = ?').run(userId);
    return 'ok';
  }

  // ---- Robbery: wallet coins only, the bank is untouchable ----

  robCooldownRemaining(userId: string, now: Date = new Date()): number {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT last_rob FROM users WHERE user_id = ?').get(userId) as {
      last_rob: string | null;
    };
    if (!row.last_rob) return 0;
    const readyAt = Date.parse(row.last_rob) + ROB_COOLDOWN_MS;
    return Math.max(0, readyAt - now.getTime());
  }

  /** roll is injectable for tests; < ROB_SUCCESS_RATE means success. */
  tryRob(thiefId: string, victimId: string, now: Date = new Date(), roll = Math.random()): RobOutcome {
    const remaining = this.robCooldownRemaining(thiefId, now);
    if (remaining > 0) {
      return { result: 'cooldown', retryAt: new Date(now.getTime() + remaining) };
    }
    const victimWallet = this.getBalance(victimId);
    if (victimWallet < ROB_MIN_VICTIM_WALLET) return { result: 'victim_poor' };

    this.db
      .prepare('UPDATE users SET last_rob = ? WHERE user_id = ?')
      .run(now.toISOString(), thiefId);

    if (roll < ROB_SUCCESS_RATE) {
      const amount = Math.min(
        ROB_TAKE_CAP,
        Math.max(100, Math.floor(victimWallet * ROB_TAKE_RATE)),
      );
      const run = this.db.transaction(() => {
        const taken = this.db
          .prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?')
          .run(amount, victimId, amount);
        if (taken.changes === 0) throw new Error('race');
        this.db
          .prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?')
          .run(amount, thiefId);
        this.logTx(victimId, -amount, 'rob_out', thiefId);
        this.logTx(thiefId, amount, 'rob_in', victimId);
      });
      try {
        run();
        return { result: 'success', amount };
      } catch {
        return { result: 'victim_poor' };
      }
    }
    return { result: 'jailed', releaseAt: this.jail(thiefId, JAIL_MINUTES, now) };
  }

  // ---- Marriage ----

  spouseOf(userId: string): string | null {
    this.ensureUser(userId);
    const row = this.db.prepare('SELECT married_to FROM users WHERE user_id = ?').get(userId) as {
      married_to: string | null;
    };
    return row.married_to;
  }

  marry(a: string, b: string, now: Date = new Date()): boolean {
    this.ensureUser(a);
    this.ensureUser(b);
    if (this.spouseOf(a) || this.spouseOf(b)) return false;
    const run = this.db.transaction(() => {
      const stamp = now.toISOString();
      this.db
        .prepare('UPDATE users SET married_to = ?, married_at = ? WHERE user_id = ?')
        .run(b, stamp, a);
      this.db
        .prepare('UPDATE users SET married_to = ?, married_at = ? WHERE user_id = ?')
        .run(a, stamp, b);
    });
    run();
    return true;
  }

  /** Divorce fee comes out of the initiator's wallet. */
  divorce(userId: string): { ok: boolean; ex?: string; reason?: 'single' | 'poor' } {
    const ex = this.spouseOf(userId);
    if (!ex) return { ok: false, reason: 'single' };
    if (!this.debit(userId, DIVORCE_FEE, 'divorce_fee')) return { ok: false, reason: 'poor' };
    const run = this.db.transaction(() => {
      this.db
        .prepare('UPDATE users SET married_to = NULL, married_at = NULL WHERE user_id IN (?, ?)')
        .run(userId, ex);
    });
    run();
    return { ok: true, ex };
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
