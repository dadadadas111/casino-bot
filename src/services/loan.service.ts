import type { Db } from '../db/database.js';
import type { AssetsService } from './assets.service.js';
import { SEIZE_RATE } from './assets.service.js';
import { JOB_CREDIT, rankFor } from './job.service.js';

export const LOAN_TERM_MS = 24 * 60 * 60 * 1000;
export const LOAN_INTEREST = 0.2; // owed on top of the principal at maturity
export const LATE_RATE_PER_HOUR = 0.05; // on the principal, compounding by the hour
export const LOAN_BASE_LIMIT = 5_000;
export const LOAN_MIN = 1_000;
/** Grace after maturity before the collector shows up. */
export const SEIZE_AFTER_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_JAIL_MS = 15 * 60 * 1000;
/** Per (collector, debtor) pair, so nobody can spam the shaming. */
export const DUN_COOLDOWN_MS = 10 * 60 * 1000;
export const DUN_WORK_BONUS = 0.1;

export interface Loan {
  id: number;
  userId: string;
  principal: number;
  dueAt: Date;
  takenAt: Date;
  dunned: number;
  guildId: string | null;
  channelId: string | null;
}

interface LoanRow {
  id: number;
  user_id: string;
  principal: number;
  due_at: string;
  taken_at: string;
  dunned: number;
  guild_id: string | null;
  channel_id: string | null;
}

/** Hours past due, floored; 0 while the loan is still in term. */
export function overdueHours(dueAt: Date, now: Date): number {
  const late = now.getTime() - dueAt.getTime();
  return late <= 0 ? 0 : Math.floor(late / (60 * 60 * 1000));
}

/** Principal plus fixed interest plus the late penalty. Pure. */
export function amountDue(principal: number, dueAt: Date, now: Date): number {
  const late = overdueHours(dueAt, now);
  return Math.ceil(principal * (1 + LOAN_INTEREST + LATE_RATE_PER_HOUR * late));
}

/** How much this player may borrow right now. Pure. */
export function creditLimit(shifts: number, assetValue: number): number {
  return LOAN_BASE_LIMIT + (JOB_CREDIT[rankFor(shifts).key] ?? 0) + Math.floor(assetValue * 0.3);
}

const toLoan = (row: LoanRow): Loan => ({
  id: row.id,
  userId: row.user_id,
  principal: row.principal,
  dueAt: new Date(row.due_at),
  takenAt: new Date(row.taken_at),
  dunned: row.dunned,
  guildId: row.guild_id,
  channelId: row.channel_id,
});

export type SeizeStep = 'vi' | 'ket' | 'taisan' | 'tu';

export interface SeizeResult {
  loan: Loan;
  owed: number;
  recovered: number;
  steps: SeizeStep[];
  soldAssets: string[];
  jailedUntil: Date | null;
}

/** Only the economy bits the collector needs, so this file stays testable. */
export interface LoanEconomy {
  getBalance(userId: string): number;
  getBank(userId: string): number;
  debit(userId: string, amount: number, type: string, meta?: string): boolean;
  credit(userId: string, amount: number, type: string, meta?: string): void;
  withdrawBank(userId: string, amount: number): boolean;
  jail(userId: string, durationMs: number, now?: Date): Date;
}

export class LoanService {
  constructor(
    private db: Db,
    private economy: LoanEconomy,
    private assets: AssetsService,
    /** Interest and recovered penalties feed the lottery pot. */
    private treasury: { addToJackpot(amount: number): void } | null = null,
  ) {}

  open(userId: string): Loan | null {
    const row = this.db
      .prepare("SELECT * FROM loans WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
      .get(userId) as LoanRow | undefined;
    return row ? toLoan(row) : null;
  }

  limitFor(userId: string, shifts: number): number {
    return creditLimit(shifts, this.assets.netWorth(userId));
  }

  borrow(
    userId: string,
    amount: number,
    shifts: number,
    guildId: string | null,
    channelId: string | null,
    now: Date = new Date(),
  ): { ok: boolean; reason?: 'has_loan' | 'too_small' | 'over_limit'; loan?: Loan } {
    if (this.open(userId)) return { ok: false, reason: 'has_loan' };
    if (!Number.isInteger(amount) || amount < LOAN_MIN) return { ok: false, reason: 'too_small' };
    if (amount > this.limitFor(userId, shifts)) return { ok: false, reason: 'over_limit' };

    const dueAt = new Date(now.getTime() + LOAN_TERM_MS);
    const info = this.db
      .prepare(
        'INSERT INTO loans (user_id, principal, due_at, taken_at, guild_id, channel_id) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(userId, amount, dueAt.toISOString(), now.toISOString(), guildId, channelId);
    this.economy.credit(userId, amount, 'loan_out', String(info.lastInsertRowid));
    return { ok: true, loan: this.open(userId)! };
  }

  /** Repay in full. Wallet first, then the vault. */
  repay(
    userId: string,
    now: Date = new Date(),
  ): { ok: boolean; reason?: 'no_loan' | 'poor'; paid?: number; interest?: number } {
    const loan = this.open(userId);
    if (!loan) return { ok: false, reason: 'no_loan' };
    const owed = amountDue(loan.principal, loan.dueAt, now);
    const wallet = this.economy.getBalance(userId);
    if (wallet + this.economy.getBank(userId) < owed) return { ok: false, reason: 'poor' };

    if (wallet < owed) this.economy.withdrawBank(userId, owed - wallet);
    if (!this.economy.debit(userId, owed, 'loan_repay', String(loan.id))) {
      return { ok: false, reason: 'poor' };
    }
    this.settle(loan.id, 'paid', now);
    this.treasury?.addToJackpot(owed - loan.principal);
    return { ok: true, paid: owed, interest: owed - loan.principal };
  }

  private settle(id: number, status: string, now: Date): void {
    this.db
      .prepare('UPDATE loans SET status = ?, settled_at = ? WHERE id = ?')
      .run(status, now.toISOString(), id);
  }

  /** Loans whose grace period has run out. */
  defaulted(now: Date = new Date()): Loan[] {
    const cutoff = new Date(now.getTime() - SEIZE_AFTER_MS).toISOString();
    const rows = this.db
      .prepare("SELECT * FROM loans WHERE status = 'open' AND due_at <= ? ORDER BY id")
      .all(cutoff) as LoanRow[];
    return rows.map(toLoan);
  }

  /**
   * Take what can be taken: wallet, then vault, then sell assets at half
   * price. Whatever is still missing is written off and the debtor does time.
   */
  seize(loan: Loan, now: Date = new Date()): SeizeResult {
    const owed = amountDue(loan.principal, loan.dueAt, now);
    const steps: SeizeStep[] = [];
    const soldAssets: string[] = [];
    let recovered = 0;

    const wallet = Math.min(this.economy.getBalance(loan.userId), owed - recovered);
    if (wallet > 0 && this.economy.debit(loan.userId, wallet, 'loan_seize', String(loan.id))) {
      recovered += wallet;
      steps.push('vi');
    }
    if (recovered < owed) {
      const fromBank = Math.min(this.economy.getBank(loan.userId), owed - recovered);
      if (fromBank > 0 && this.economy.withdrawBank(loan.userId, fromBank)) {
        this.economy.debit(loan.userId, fromBank, 'loan_seize', String(loan.id));
        recovered += fromBank;
        steps.push('ket');
      }
    }
    if (recovered < owed) {
      // Cheapest first, so a defaulter keeps the castle as long as possible.
      for (const asset of this.assets.owned(loan.userId)) {
        if (recovered >= owed) break;
        if (!this.assets.remove(loan.userId, asset.key)) continue;
        recovered += Math.floor(asset.price * SEIZE_RATE);
        soldAssets.push(asset.key);
      }
      if (soldAssets.length > 0) steps.push('taisan');
    }

    let jailedUntil: Date | null = null;
    if (recovered < owed) {
      jailedUntil = this.economy.jail(loan.userId, DEFAULT_JAIL_MS, now);
      steps.push('tu');
    }
    this.settle(loan.id, recovered >= owed ? 'seized' : 'written_off', now);
    // Only the interest portion is house income; the principal was already
    // the player's money going out and coming back.
    this.treasury?.addToJackpot(Math.max(0, recovered - loan.principal));
    return { loan, owed, recovered, steps, soldAssets, jailedUntil };
  }

  /** Count one shaming and hand back the new total. */
  recordDun(loanId: number): number {
    this.db.prepare('UPDATE loans SET dunned = dunned + 1 WHERE id = ?').run(loanId);
    const row = this.db.prepare('SELECT dunned FROM loans WHERE id = ?').get(loanId) as {
      dunned: number;
    };
    return row.dunned;
  }

  history(userId: string): { taken: number; defaulted: number } {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) taken, SUM(CASE WHEN status = 'written_off' THEN 1 ELSE 0 END) defaulted FROM loans WHERE user_id = ?",
      )
      .get(userId) as { taken: number; defaulted: number | null };
    return { taken: row.taken, defaulted: row.defaulted ?? 0 };
  }
}
