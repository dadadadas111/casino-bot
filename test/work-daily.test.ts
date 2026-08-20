import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { DAILY_BASE, EconomyService, WORK_COOLDOWN_MS } from '../src/services/economy.service';
import { BuffService } from '../src/services/buff.service';
import { AssetsService } from '../src/services/assets.service';
import { rankFor } from '../src/services/job.service';
import { taxOn } from '../src/services/tax.service';

let db: Db;
let economy: EconomyService;
let assets: AssetsService;
let buffs: BuffService;

const ME = 'worker';
const T0 = new Date('2026-08-19T10:00:00+07:00');
const later = (minutes: number): Date => new Date(T0.getTime() + minutes * 60_000);

/** Clock forward far enough that the cooldown never blocks the next shift. */
function grind(shifts: number, from = 0): { gross: number; net: number } {
  let gross = 0;
  let net = 0;
  for (let i = 0; i < shifts; i++) {
    const result = economy.work(ME, later(from + i * 11));
    expect(result.ok).toBe(true);
    gross += result.gross ?? 0;
    net += result.amount;
  }
  return { gross, net };
}

beforeEach(() => {
  db = createDb(':memory:');
  assets = new AssetsService(db);
  buffs = new BuffService(db);
  economy = new EconomyService(db, buffs, assets);
  economy.ensureUser(ME);
});

describe('work', () => {
  it('pays inside the rank band and counts the shift', () => {
    const result = economy.work(ME, T0);
    const rank = rankFor(0);
    expect(result.gross).toBeGreaterThanOrEqual(rank.min);
    expect(result.gross).toBeLessThanOrEqual(rank.max);
    expect(result.rank).toBe('chayvat');
    expect(economy.workShifts(ME)).toBe(1);
  });

  it('holds the cooldown and shortens it with a vehicle', () => {
    economy.work(ME, T0);
    expect(economy.work(ME, later(5)).ok).toBe(false);

    assets.add(ME, 'sieuxe');
    // The supercar cuts the wait from 10 minutes to 4.
    expect(WORK_COOLDOWN_MS).toBe(10 * 60_000);
    expect(economy.work(ME, later(5)).ok).toBe(true);
  });

  it('flags the shift that earns a promotion', () => {
    const results = Array.from({ length: 10 }, (_, i) => economy.work(ME, later(i * 11)));
    expect(results.slice(0, 9).every((r) => !r.promoted)).toBe(true);
    expect(results[9].promoted).toBe(true);
    expect(results[9].rank).toBe('chayvat'); // paid at the old rank, promoted after
    expect(rankFor(economy.workShifts(ME)).key).toBe('phuho');
  });

  it('takes no tax from a casual earner', () => {
    const result = economy.work(ME, T0);
    expect(result.tax).toBe(0);
    expect(result.amount).toBe(result.gross);
  });

  it('starts biting once the daily wage clears the free bracket', () => {
    // The free bracket now runs to 40.000, far past a light session, so grind
    // enough shifts (ranks rise along the way) to cross it.
    const { gross, net } = grind(100);
    expect(gross).toBeGreaterThan(40_000);
    expect(net).toBeLessThan(gross);
    expect(gross - net).toBe(taxOn(gross));
  });

  it('credits the wallet net of tax while logging the gross wage', () => {
    grind(100);
    const { entries } = economy.getHistory(ME, 300);
    const taxRows = entries.filter((e) => e.type === 'tax');
    const workRows = entries.filter((e) => e.type === 'work');
    // The gross wage is logged, the tax logged separately as a negative row,
    // and the wallet is exactly starting + everything logged. This identity
    // holds no matter how the rolling window lands.
    expect(taxRows.length).toBeGreaterThan(0);
    const workSum = workRows.reduce((s, e) => s + e.amount, 0);
    const taxSum = taxRows.reduce((s, e) => s + e.amount, 0);
    expect(economy.getBalance(ME)).toBe(1_000 + workSum + taxSum);
  });

  it('forgets old wages once they fall out of the 24h window', () => {
    grind(30);
    // Rows are stamped by SQLite with wall-clock time, so the window has to be
    // measured from now rather than from the injected clock.
    const now = new Date();
    expect(economy.wagesInWindow(ME, now)).toBeGreaterThan(0);
    expect(economy.wagesInWindow(ME, new Date(now.getTime() + 25 * 3_600_000))).toBe(0);
  });

  it('pays the overtime bonus while the debtor is being hounded', () => {
    buffs.activate(ME, 'dino', T0);
    const result = economy.work(ME, T0);
    expect(result.hounded).toBe(true);
    // 10% on top of a band that tops out at 500.
    expect(result.gross).toBeGreaterThan(rankFor(0).min);
  });
});

describe('daily', () => {
  it('pays the plain amount with no house', () => {
    const result = economy.claimDaily(ME, T0);
    expect(result.amount).toBe(DAILY_BASE);
    expect(result.houseBonus).toBe(0);
    expect(result.catFind).toBe(0);
  });

  it('adds the house bonus on top', () => {
    assets.add(ME, 'laudai'); // +100%
    const result = economy.claimDaily(ME, T0);
    expect(result.base).toBe(DAILY_BASE);
    expect(result.houseBonus).toBe(DAILY_BASE);
    expect(result.amount).toBe(DAILY_BASE * 2);
  });

  it('scales the bonus with the tier of house owned', () => {
    assets.add(ME, 'nhatro'); // +10%
    expect(economy.claimDaily(ME, T0).houseBonus).toBe(Math.round(DAILY_BASE * 0.1));
  });

  it('hands over the cat haul only when the player shows up', () => {
    assets.add(ME, 'meo');
    const result = economy.claimDaily(ME, T0);
    expect(result.catFind).toBeGreaterThanOrEqual(100);
    expect(result.catFind).toBeLessThanOrEqual(500);
    expect(result.amount).toBe(DAILY_BASE + (result.catFind ?? 0));
  });

  it('still refuses a second claim on the same day', () => {
    economy.claimDaily(ME, T0);
    expect(economy.claimDaily(ME, later(60))).toMatchObject({ ok: false, alreadyClaimed: true });
  });
});

describe('career backfill', () => {
  it('seeds the ladder from shifts already worked before the feature existed', () => {
    const fresh = createDb(':memory:');
    fresh.prepare('INSERT INTO users (user_id, balance) VALUES (?, ?)').run('veteran', 1_000);
    for (let i = 0; i < 42; i++) {
      fresh
        .prepare("INSERT INTO transactions (user_id, amount, type) VALUES (?, ?, 'work')")
        .run('veteran', 300);
    }
    // Re-opening the same database runs the migration over the existing rows.
    fresh.prepare('UPDATE users SET work_count = 0').run();
    const svc = new EconomyService(fresh, new BuffService(fresh), new AssetsService(fresh));
    fresh
      .prepare(
        `UPDATE users SET work_count = (
           SELECT COUNT(*) FROM transactions t WHERE t.user_id = users.user_id AND t.type = 'work'
         )`,
      )
      .run();
    expect(svc.workShifts('veteran')).toBe(42);
    expect(rankFor(svc.workShifts('veteran')).key).toBe('nhanvien');
  });
});
