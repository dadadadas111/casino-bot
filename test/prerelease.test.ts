import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService, ROB_COOLDOWN_MS, STARTING_BALANCE } from '../src/services/economy.service';
import { ItemsService } from '../src/services/items.service';
import { ActivityService } from '../src/services/activity.service';
import { ReportService } from '../src/services/report.service';
import { LoginThrottle } from '../src/web/auth';

let db: Db;
let economy: EconomyService;
let items: ItemsService;
let activity: ActivityService;
let reports: ReportService;

const t0 = new Date('2026-08-18T10:00:00+07:00');

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  items = new ItemsService(db);
  activity = new ActivityService(db);
  reports = new ReportService(db);
});

describe('shielded robbery', () => {
  it('spends the attempt without jailing the thief', () => {
    economy.startRobCooldown('thief', t0);
    expect(economy.jailedUntil('thief', t0)).toBeNull();
    expect(economy.robCooldownRemaining('thief', t0)).toBeGreaterThan(0);
    expect(economy.offenseCount('thief', 'jail', t0)).toBe(0);
    const later = new Date(t0.getTime() + ROB_COOLDOWN_MS + 1000);
    expect(economy.robCooldownRemaining('thief', later)).toBe(0);
  });
});

describe('leaderboard scoping', () => {
  it('lists only players seen in this guild', () => {
    activity.recordUser('g1', 'local', t0);
    activity.recordUser('g2', 'stranger', t0);
    economy.credit('stranger', 500_000, 'admin_add');
    economy.credit('local', 100, 'admin_add');

    const board = reports.topUsers('g1', 10);
    expect(board.map((r) => r.userId)).toEqual(['local']);
    expect(economy.topByBalance(10).map((r) => r.userId)).toContain('stranger');
  });
});

describe('item gifting cannot duplicate items', () => {
  it('moves exactly the given quantity and refuses overdrafts', () => {
    items.add('giver', 'khien', 2);
    expect(items.transfer('giver', 'taker', 'khien', 3)).toBe(false);
    expect(items.count('giver', 'khien')).toBe(2);
    expect(items.transfer('giver', 'taker', 'khien', 2)).toBe(true);
    expect(items.count('giver', 'khien')).toBe(0);
    expect(items.count('taker', 'khien')).toBe(2);
    expect(items.transfer('giver', 'taker', 'khien', 1)).toBe(false);
  });
});

describe('newsletter defaults', () => {
  it('does not ping everyone until a server opts in', () => {
    expect(reports.getConfig('fresh-guild').tagEveryone).toBe(false);
    reports.updateConfig('fresh-guild', { tagEveryone: true });
    expect(reports.getConfig('fresh-guild').tagEveryone).toBe(true);
  });
});

describe('login throttle', () => {
  it('locks out after repeated failures and forgets expired entries', () => {
    const throttle = new LoginThrottle(3, 1_000);
    const now = 1_000_000;
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
    throttle.recordFailure('1.2.3.4', now);
    throttle.recordFailure('1.2.3.4', now);
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
    throttle.recordFailure('1.2.3.4', now);
    expect(throttle.lockedFor('1.2.3.4', now)).toBeGreaterThan(0);
    expect(throttle.lockedFor('1.2.3.4', now + 2_000)).toBe(0);
    throttle.reset('1.2.3.4');
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
  });
});

describe('balance history stays reconstructible', () => {
  it('logs a delta for every path that moves the wallet', () => {
    economy.claimDaily('u1', t0);
    economy.work('u1', t0);
    economy.depositBank('u1', 300);
    economy.withdrawBank('u1', 100);
    economy.debit('u1', 50, 'bet', 'slots');
    economy.settleGame('u1', 50, 120, 'slots');
    economy.credit('victim', 9_000, 'admin_add');
    economy.tryRob('u1', 'victim', t0, 0.1);

    const { entries } = economy.getHistory('u1', 50);
    // Walking the logged deltas backwards must land on the starting balance.
    const walked = entries.reduce((sum, e) => sum - e.amount, economy.getBalance('u1'));
    expect(walked).toBe(0);
    expect(entries[entries.length - 1]).toMatchObject({ type: 'welcome', balanceAfter: STARTING_BALANCE });
  });
});
