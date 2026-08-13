import type { Db } from '../db/database.js';

/** 1đ of premium cash buys this many xu. Strictly one-way. */
export const XU_PER_VND = 20;

/**
 * Premium currency, unit = VND (real money). One-way by design: cash comes in
 * via top-ups and can be spent on perks or converted down to xu, but xu never
 * converts back and cash is never paid out. Ledger lives in cash_ledger,
 * separate from the xu transactions table so history math stays consistent.
 */
export class CashService {
  constructor(private db: Db) {}

  private ensure(userId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 1000)')
      .run(userId);
  }

  get(userId: string): number {
    this.ensure(userId);
    const row = this.db.prepare('SELECT cash FROM users WHERE user_id = ?').get(userId) as {
      cash: number;
    };
    return row.cash;
  }

  credit(userId: string, amountVnd: number, meta?: string): boolean {
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) return false;
    this.ensure(userId);
    const run = this.db.transaction(() => {
      this.db.prepare('UPDATE users SET cash = cash + ? WHERE user_id = ?').run(amountVnd, userId);
      this.db
        .prepare('INSERT INTO cash_ledger (user_id, amount, type, meta) VALUES (?, ?, ?, ?)')
        .run(userId, amountVnd, 'topup', meta ?? null);
    });
    run();
    return true;
  }

  spend(userId: string, amountVnd: number, meta: string): boolean {
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) return false;
    this.ensure(userId);
    const run = this.db.transaction(() => {
      const taken = this.db
        .prepare('UPDATE users SET cash = cash - ? WHERE user_id = ? AND cash >= ?')
        .run(amountVnd, userId, amountVnd);
      if (taken.changes === 0) throw new Error('insufficient');
      this.db
        .prepare('INSERT INTO cash_ledger (user_id, amount, type, meta) VALUES (?, ?, ?, ?)')
        .run(userId, -amountVnd, 'spend', meta);
    });
    try {
      run();
      return true;
    } catch {
      return false;
    }
  }
}
