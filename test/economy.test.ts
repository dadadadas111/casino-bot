import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import {
  EconomyService,
  QUIZ_BIG_WIN_PRIZE,
  QUIZ_COOLDOWN_MS,
  QUIZ_WIN_COOLDOWN_MS,
  STARTING_BALANCE,
  WORK_COOLDOWN_MS,
  WORK_MAX,
  WORK_MIN,
  vnDay,
} from '../src/services/economy.service';

let db: Db;
let economy: EconomyService;

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
});

describe('balances', () => {
  it('gives new users the starting balance', () => {
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE);
  });

  it('debits atomically and rejects insufficient balance', () => {
    expect(economy.debit('u1', 400, 'bet')).toBe(true);
    expect(economy.getBalance('u1')).toBe(600);
    expect(economy.debit('u1', 601, 'bet')).toBe(false);
    expect(economy.getBalance('u1')).toBe(600);
  });

  it('rejects non-positive and fractional amounts', () => {
    expect(economy.debit('u1', 0, 'bet')).toBe(false);
    expect(economy.debit('u1', -5, 'bet')).toBe(false);
    expect(economy.debit('u1', 1.5, 'bet')).toBe(false);
  });

  it('transfers between users', () => {
    expect(economy.transfer('u1', 'u2', 300)).toBe(true);
    expect(economy.getBalance('u1')).toBe(700);
    expect(economy.getBalance('u2')).toBe(1300);
    expect(economy.transfer('u1', 'u2', 100_000)).toBe(false);
    expect(economy.getBalance('u1')).toBe(700);
  });
});

describe('claimDaily', () => {
  const day1 = new Date('2026-08-09T10:00:00+07:00');
  const day1Later = new Date('2026-08-09T23:00:00+07:00');
  const day2 = new Date('2026-08-10T08:00:00+07:00');
  const day4 = new Date('2026-08-12T08:00:00+07:00');

  it('uses Vietnam timezone day boundaries', () => {
    // 00:30 VN time is still the previous day in UTC
    expect(vnDay(new Date('2026-08-09T00:30:00+07:00'))).toBe('2026-08-09');
    expect(vnDay(new Date('2026-08-08T23:30:00+07:00'))).toBe('2026-08-08');
  });

  it('pays the base amount on first claim and blocks a second claim the same day', () => {
    const first = economy.claimDaily('u1', day1);
    expect(first).toMatchObject({ ok: true, amount: 500, streak: 1 });
    const again = economy.claimDaily('u1', day1Later);
    expect(again).toMatchObject({ ok: false, alreadyClaimed: true });
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + 500);
  });

  it('grows the streak on consecutive days', () => {
    economy.claimDaily('u1', day1);
    const second = economy.claimDaily('u1', day2);
    expect(second).toMatchObject({ ok: true, amount: 600, streak: 2 });
  });

  it('resets the streak after a missed day', () => {
    economy.claimDaily('u1', day1);
    economy.claimDaily('u1', day2);
    const afterGap = economy.claimDaily('u1', day4);
    expect(afterGap).toMatchObject({ ok: true, amount: 500, streak: 1 });
  });
});

describe('work', () => {
  const t0 = new Date('2026-08-11T10:00:00Z');

  it('pays a wage within range and starts the hourly cooldown', () => {
    const result = economy.work('u1', t0);
    expect(result.ok).toBe(true);
    expect(result.amount).toBeGreaterThanOrEqual(WORK_MIN);
    expect(result.amount).toBeLessThanOrEqual(WORK_MAX);
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + result.amount);
    expect(result.retryAt.getTime()).toBe(t0.getTime() + WORK_COOLDOWN_MS);
  });

  it('blocks a second shift inside the cooldown and allows one after', () => {
    economy.work('u1', t0);
    const blocked = economy.work('u1', new Date(t0.getTime() + WORK_COOLDOWN_MS / 2));
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAt.getTime()).toBe(t0.getTime() + WORK_COOLDOWN_MS);
    const later = economy.work('u1', new Date(t0.getTime() + WORK_COOLDOWN_MS + 1000));
    expect(later.ok).toBe(true);
  });

  it('shows up in history as a work transaction', () => {
    economy.work('u1', t0);
    const { entries } = economy.getHistory('u1', 1);
    expect(entries[0].type).toBe('work');
  });
});

describe('resetCooldown', () => {
  const t0 = new Date('2026-08-11T10:00:00+07:00');

  it('daily reset allows immediate re-claim and continues the streak', () => {
    economy.claimDaily('u1', t0); // streak 1
    economy.resetCooldown('u1', 'daily', t0);
    const again = economy.claimDaily('u1', t0);
    expect(again).toMatchObject({ ok: true, streak: 2 });
  });

  it('work reset clears the hourly cooldown', () => {
    economy.work('u1', t0);
    expect(economy.work('u1', t0).ok).toBe(false);
    economy.resetCooldown('u1', 'work', t0);
    expect(economy.work('u1', t0).ok).toBe(true);
  });

  it('trieuphu reset allows another quiz today', () => {
    economy.markQuizPlayed('u1', t0);
    expect(economy.canPlayQuiz('u1', t0)).toBe(false);
    economy.resetCooldown('u1', 'trieuphu', t0);
    expect(economy.canPlayQuiz('u1', t0)).toBe(true);
  });

  it('all resets everything at once', () => {
    economy.claimDaily('u1', t0);
    economy.work('u1', t0);
    economy.markQuizPlayed('u1', t0);
    economy.resetCooldown('u1', 'all', t0);
    expect(economy.claimDaily('u1', t0).ok).toBe(true);
    expect(economy.work('u1', t0).ok).toBe(true);
    expect(economy.canPlayQuiz('u1', t0)).toBe(true);
  });
});

describe('quiz cooldown by outcome', () => {
  const t0 = new Date('2026-08-11T10:00:00+07:00');
  const at = (ms: number) => new Date(t0.getTime() + ms);

  it('opening a game locks the base window', () => {
    economy.markQuizPlayed('u1', t0);
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS - 1000))).toBe(false);
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS + 1000))).toBe(true);
  });

  it('a small win or a loss keeps the base window', () => {
    economy.markQuizPlayed('u1', t0);
    economy.setQuizCooldown('u1', QUIZ_BIG_WIN_PRIZE - 1, t0); // e.g. lost, small floor
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS - 1000))).toBe(false);
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS + 1000))).toBe(true);
  });

  it('a big payout locks the long window, closing the stop-at-14 loophole', () => {
    economy.markQuizPlayed('u1', t0);
    economy.setQuizCooldown('u1', 84_000, t0); // walked away at câu 14
    // still locked long after the base window would have opened
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS + 1000))).toBe(false);
    expect(economy.canPlayQuiz('u1', at(QUIZ_WIN_COOLDOWN_MS - 1000))).toBe(false);
    expect(economy.canPlayQuiz('u1', at(QUIZ_WIN_COOLDOWN_MS + 1000))).toBe(true);
  });

  it('the big-win threshold itself counts as big', () => {
    economy.setQuizCooldown('u1', QUIZ_BIG_WIN_PRIZE, t0);
    expect(economy.canPlayQuiz('u1', at(QUIZ_COOLDOWN_MS + 1000))).toBe(false);
  });
});

describe('settleGame', () => {
  it('credits payouts and tracks win/loss stats', () => {
    economy.debit('u1', 100, 'bet', 'test');
    economy.settleGame('u1', 100, 200, 'test'); // net +100
    let profile = economy.getProfile('u1');
    expect(profile.balance).toBe(STARTING_BALANCE + 100);
    expect(profile.totalWon).toBe(100);
    expect(profile.gamesPlayed).toBe(1);

    economy.debit('u1', 100, 'bet', 'test');
    economy.settleGame('u1', 100, 0, 'test'); // net -100
    profile = economy.getProfile('u1');
    expect(profile.balance).toBe(STARTING_BALANCE);
    expect(profile.totalLost).toBe(100);
    expect(profile.gamesPlayed).toBe(2);
  });

  it('treats a push as neutral', () => {
    economy.debit('u1', 100, 'bet', 'test');
    economy.settleGame('u1', 100, 100, 'test');
    const profile = economy.getProfile('u1');
    expect(profile.balance).toBe(STARTING_BALANCE);
    expect(profile.totalWon).toBe(0);
    expect(profile.totalLost).toBe(0);
  });
});

describe('getHistory', () => {
  it('returns newest first with a correct running balance', () => {
    const day1 = new Date('2026-08-09T10:00:00+07:00');
    economy.claimDaily('u1', day1); // +500 -> 1500
    economy.debit('u1', 200, 'bet', 'slots'); // -200 -> 1300
    economy.settleGame('u1', 200, 400, 'slots'); // +400 -> 1700

    const { entries, total } = economy.getHistory('u1', 3);
    expect(total).toBe(4); // welcome + daily + bet + payout
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ type: 'payout', amount: 400, balanceAfter: 1700 });
    expect(entries[1]).toMatchObject({ type: 'bet', amount: -200, balanceAfter: 1300 });
    expect(entries[2]).toMatchObject({ type: 'daily', amount: 500, balanceAfter: 1500 });
  });

  it('logs admin_set as a delta so the walk stays consistent', () => {
    economy.setBalance('u1', 4000); // from 1000 -> delta +3000
    const { entries } = economy.getHistory('u1', 2);
    expect(entries[0]).toMatchObject({ type: 'admin_set', amount: 3000, balanceAfter: 4000 });
    expect(entries[1]).toMatchObject({ type: 'welcome', amount: 1000, balanceAfter: 1000 });
  });
});

describe('topByBalance', () => {
  it('ranks users by balance', () => {
    economy.ensureUser('rich');
    economy.credit('rich', 5000, 'admin_add');
    economy.ensureUser('poor');
    economy.debit('poor', 900, 'bet');
    const top = economy.topByBalance(10);
    expect(top[0]).toMatchObject({ userId: 'rich', balance: 6000 });
    expect(top.at(-1)).toMatchObject({ userId: 'poor', balance: 100 });
    expect(economy.getProfile('rich').rank).toBe(1);
  });
});
