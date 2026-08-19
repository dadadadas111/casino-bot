import type { Db } from '../db/database.js';
import { BuffService, LUCKY_BONUS_RATE } from './buff.service.js';
import { AssetsService, CAT_MAX, CAT_MIN } from './assets.service.js';
import { DUN_WORK_BONUS } from './loan.service.js';
import { rankFor } from './job.service.js';
import { marginalRate, taxOnWage } from './tax.service.js';

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
  /** Base pay before the house bonus, for showing the breakdown. */
  base?: number;
  houseBonus?: number;
  catFind?: number;
}

// Work is the anti-bankruptcy floor: frequent, small, and safe.
export const WORK_COOLDOWN_MS = 10 * 60 * 1000;
export const WORK_MIN = 200;
export const WORK_MAX = 500;

// Crime should pay a little more than honest work, not twenty times more.
export const ROB_COOLDOWN_MS = 60 * 60 * 1000;
export const ROB_SUCCESS_RATE = 0.4;
export const ROB_TAKE_RATE = 0.12;
export const ROB_MIN_VICTIM_WALLET = 500;
export const ROB_TAKE_CAP = 5_000;
export const JAIL_DURATION_MS = 5 * 60_000; // 5 phút
export const HOSPITAL_DURATION_MS = 3 * 60_000 + 36_000; // 3 phút 36 giây
/** Release fees scale with how often you reoffend; the tally clears after a day. */
export const BAIL_BASE_COST = 1_000;
export const MEDICAL_BASE_FEE = 1_000;
export const OFFENSE_RESET_MS = 24 * 60 * 60 * 1000;

export type OffenseKind = 'jail' | 'hospital';
export const DIVORCE_FEE = 1_000;

export type RobOutcome =
  | { result: 'cooldown'; retryAt: Date }
  | { result: 'victim_poor' }
  | { result: 'success'; amount: number }
  | { result: 'jailed'; releaseAt: Date };

export interface WorkResult {
  ok: boolean;
  /** What actually landed in the wallet, after tax. */
  amount: number;
  retryAt: Date;
  gross?: number;
  tax?: number;
  rank?: string;
  promoted?: boolean;
  shifts?: number;
  /** Marginal tax rate the player now stands on, for the nudge line. */
  bracket?: number;
  hounded?: boolean;
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
    private assets: AssetsService = new AssetsService(db),
  ) {}

  /**
   * Where collected tax goes. Wired to the lottery jackpot at startup; kept
   * as a hook so this service does not have to know the lottery exists.
   */
  private treasury: ((amount: number, reason: string) => void) | null = null;

  setTreasury(sink: (amount: number, reason: string) => void): void {
    this.treasury = sink;
  }

  /**
   * Wages earned in the trailing 24h; the base for the income tax ladder.
   * Rows carry SQLite wall-clock timestamps, so an injected `now` only makes
   * sense as the real current time (which is what every caller passes).
   */
  wagesInWindow(userId: string, now: Date = new Date()): number {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const row = this.db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE user_id = ? AND type = 'work' AND created_at >= ?",
      )
      .get(userId, since) as { total: number };
    return row.total;
  }

  workShifts(userId: string): number {
    this.ensureUser(userId);
    const row = this.db
      .prepare('SELECT work_count FROM users WHERE user_id = ?')
      .get(userId) as { work_count: number };
    return row.work_count;
  }

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

  /**
   * Rank is counted among members of `guildId` when one is given. The wallet
   * is global but a standing only means something against people you share a
   * server with.
   */
  getProfile(userId: string, guildId: string | null = null): Profile {
    this.ensureUser(userId);
    const row = this.db
      .prepare(
        `SELECT balance, daily_streak, total_won, total_lost, games_played,
           (SELECT COUNT(*) + 1 FROM users u2
                  WHERE u2.balance > u.balance
                    AND (? IS NULL OR EXISTS (
                          SELECT 1 FROM user_guilds g2
                          WHERE g2.user_id = u2.user_id AND g2.guild_id = ?))) AS rank
         FROM users u WHERE user_id = ?`,
      )
      .get(guildId, guildId, userId) as {
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
    const base = DAILY_BASE + Math.min(streak - 1, DAILY_STREAK_CAP) * DAILY_STREAK_BONUS;
    // A house pays off exactly here: it is what makes the daily worth typing.
    const paid = Math.round(base * this.assets.dailyMultiplier(userId));
    const houseBonus = paid - base;
    this.db
      .prepare(
        'UPDATE users SET balance = balance + ?, last_daily = ?, daily_streak = ? WHERE user_id = ?',
      )
      .run(paid, today, streak, userId);
    this.logTx(userId, paid, 'daily', `streak:${streak}`);

    // The cat only hands over its haul when you show up.
    let catFind = 0;
    if (this.assets.has(userId, 'meo')) {
      catFind = CAT_MIN + 10 * Math.floor((Math.random() * (CAT_MAX - CAT_MIN)) / 10 + 1);
      this.credit(userId, catFind, 'pet_find', 'meo');
    }
    return {
      ok: true,
      amount: paid + catFind,
      streak,
      alreadyClaimed: false,
      base,
      houseBonus,
      catFind,
    };
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
    const row = this.db
      .prepare('SELECT last_work, work_count FROM users WHERE user_id = ?')
      .get(userId) as { last_work: string | null; work_count: number };
    const cooldownMs = this.assets.workCooldownMs(userId, WORK_COOLDOWN_MS);
    if (row.last_work) {
      const readyAt = new Date(Date.parse(row.last_work) + cooldownMs);
      if (readyAt.getTime() > now.getTime()) {
        return { ok: false, amount: 0, retryAt: readyAt };
      }
    }

    const rank = rankFor(row.work_count);
    const steps = (rank.max - rank.min) / 10 + 1;
    let gross = rank.min + 10 * Math.floor(Math.random() * steps);
    // Being hounded for a debt means picking up overtime.
    const hounded = this.buffs.activeUntil(userId, 'dino', now) !== null;
    if (hounded) gross = Math.round(gross * (1 + DUN_WORK_BONUS));

    const earnedSoFar = this.wagesInWindow(userId, now);
    const tax = taxOnWage(earnedSoFar, gross);
    const net = gross - tax;

    this.db
      .prepare(
        'UPDATE users SET balance = balance + ?, last_work = ?, work_count = work_count + 1 WHERE user_id = ?',
      )
      .run(net, now.toISOString(), userId);
    // Log the gross so the tax window stays consistent, then the deduction
    // separately so /lichsu shows where the missing coins went.
    this.logTx(userId, gross, 'work', `rank:${rank.key}`);
    if (tax > 0) {
      this.logTx(userId, -tax, 'tax', `wage:${gross}`);
      this.treasury?.(tax, 'tax');
    }

    return {
      ok: true,
      amount: net,
      retryAt: new Date(now.getTime() + cooldownMs),
      gross,
      tax,
      rank: rank.key,
      promoted: rankFor(row.work_count).key !== rankFor(row.work_count + 1).key,
      shifts: row.work_count + 1,
      bracket: marginalRate(earnedSoFar + gross),
      hounded,
    };
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

  /** Offences within the last day; 0 once the tally has aged out. */
  offenseCount(userId: string, kind: OffenseKind, now: Date = new Date()): number {
    this.ensureUser(userId);
    const row = this.db
      .prepare(`SELECT ${kind}_count AS n, ${kind}_count_at AS at FROM users WHERE user_id = ?`)
      .get(userId) as { n: number; at: string | null };
    if (!row.at || now.getTime() - Date.parse(row.at) > OFFENSE_RESET_MS) return 0;
    return row.n;
  }

  /** What it costs to buy your way out right now. */
  releaseFee(userId: string, kind: OffenseKind, now: Date = new Date()): number {
    const base = kind === 'jail' ? BAIL_BASE_COST : MEDICAL_BASE_FEE;
    return base * Math.max(1, this.offenseCount(userId, kind, now));
  }

  private bumpOffense(userId: string, kind: OffenseKind, now: Date): void {
    const count = this.offenseCount(userId, kind, now) + 1;
    this.db
      .prepare(
        `UPDATE users SET ${kind}_count = ?, ${kind}_count_at = ?, ${kind}_total = ${kind}_total + 1
         WHERE user_id = ?`,
      )
      .run(count, now.toISOString(), userId);
  }

  jail(userId: string, durationMs: number, now: Date = new Date()): Date {
    this.ensureUser(userId);
    this.bumpOffense(userId, 'jail', now);
    const until = new Date(now.getTime() + durationMs);
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
    if (!this.debit(userId, this.releaseFee(userId, 'jail', now), 'bail')) return 'poor';
    this.db.prepare('UPDATE users SET jail_until = NULL WHERE user_id = ?').run(userId);
    return 'ok';
  }

  // ---- Hospital: same shape as jail, different flavour of downtime ----

  hospitalizedUntil(userId: string, now: Date = new Date()): Date | null {
    this.ensureUser(userId);
    const row = this.db
      .prepare('SELECT hospital_until FROM users WHERE user_id = ?')
      .get(userId) as { hospital_until: string | null };
    if (!row.hospital_until) return null;
    const until = new Date(row.hospital_until);
    return until.getTime() > now.getTime() ? until : null;
  }

  hospitalize(userId: string, durationMs: number, now: Date = new Date()): Date {
    this.ensureUser(userId);
    this.bumpOffense(userId, 'hospital', now);
    const until = new Date(now.getTime() + durationMs);
    this.db
      .prepare('UPDATE users SET hospital_until = ? WHERE user_id = ?')
      .run(until.toISOString(), userId);
    return until;
  }

  /** Discharge without paying (used by the skeleton key item). */
  discharge(userId: string): void {
    this.db.prepare('UPDATE users SET hospital_until = NULL WHERE user_id = ?').run(userId);
  }

  /** Pay the medical bill to be discharged immediately. */
  payMedicalBill(userId: string, now: Date = new Date()): 'ok' | 'not_admitted' | 'poor' {
    if (!this.hospitalizedUntil(userId, now)) return 'not_admitted';
    if (!this.debit(userId, this.releaseFee(userId, 'hospital', now), 'medical')) return 'poor';
    this.db.prepare('UPDATE users SET hospital_until = NULL WHERE user_id = ?').run(userId);
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

  /** Spend the hourly attempt without rolling for it (used when a shield eats the try). */
  startRobCooldown(userId: string, now: Date = new Date()): void {
    this.ensureUser(userId);
    this.db.prepare('UPDATE users SET last_rob = ? WHERE user_id = ?').run(now.toISOString(), userId);
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
    return { result: 'jailed', releaseAt: this.jail(thiefId, JAIL_DURATION_MS, now) };
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
