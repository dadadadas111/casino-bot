import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { ActivityService } from '../src/services/activity.service';
import { ReportService } from '../src/services/report.service';

let db: Db;
let economy: EconomyService;
let activity: ActivityService;
let reports: ReportService;

const t = (iso: string) => new Date(iso);

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  activity = new ActivityService(db);
  reports = new ReportService(db);
});

describe('ActivityService', () => {
  it('tracks the busiest channel over the window', () => {
    const now = t('2026-08-13T10:00:00+07:00');
    activity.recordChannel('g1', 'c1', now);
    activity.recordChannel('g1', 'c2', now);
    activity.recordChannel('g1', 'c2', now);
    expect(activity.topChannel('g1', now)).toBe('c2');
    expect(activity.topChannel('g2', now)).toBeNull();
  });

  it('ignores activity older than the window', () => {
    const old = t('2026-07-01T10:00:00+07:00');
    const now = t('2026-08-13T10:00:00+07:00');
    activity.recordChannel('g1', 'c-old', old);
    activity.recordChannel('g1', 'c-old', old);
    activity.recordChannel('g1', 'c-new', now);
    expect(activity.topChannel('g1', now)).toBe('c-new');
  });

  it('upserts user-guild sightings', () => {
    activity.recordUser('g1', 'u1');
    activity.recordUser('g1', 'u1');
    activity.recordUser('g1', 'u2');
    expect(reports.guildPlayerCount('g1')).toBe(2);
  });
});

describe('ReportService config', () => {
  it('returns defaults for unknown guilds', () => {
    expect(reports.getConfig('g1')).toMatchObject({
      enabled: true,
      hour: 10,
      channelId: null,
      tagEveryone: true,
    });
  });

  it('persists partial updates', () => {
    reports.updateConfig('g1', { hour: 8, tagEveryone: false });
    expect(reports.getConfig('g1')).toMatchObject({
      enabled: true,
      hour: 8,
      tagEveryone: false,
    });
    reports.updateConfig('g1', { channelId: 'c9' });
    expect(reports.getConfig('g1').channelId).toBe('c9');
    expect(reports.getConfig('g1').hour).toBe(8);
  });

  it('is due at the configured hour and only once per day', () => {
    const before = t('2026-08-13T09:59:00+07:00');
    const after = t('2026-08-13T10:01:00+07:00');
    expect(reports.isDue('g1', before)).toBe(false);
    expect(reports.isDue('g1', after)).toBe(true);
    reports.markSent('g1', after);
    expect(reports.isDue('g1', after)).toBe(false);
    expect(reports.isDue('g1', t('2026-08-14T10:01:00+07:00'))).toBe(true);
  });

  it('respects the enabled flag', () => {
    reports.updateConfig('g1', { enabled: false });
    expect(reports.isDue('g1', t('2026-08-13T10:01:00+07:00'))).toBe(false);
  });
});

describe('ReportService data', () => {
  it('ranks only users seen in the guild', () => {
    economy.credit('rich', 9_000, 'admin_add');
    economy.credit('mid', 500, 'admin_add');
    economy.ensureUser('other-guild-user');
    activity.recordUser('g1', 'rich');
    activity.recordUser('g1', 'mid');
    activity.recordUser('g2', 'other-guild-user');
    const top = reports.topUsers('g1', 10);
    expect(top.map((u) => u.userId)).toEqual(['rich', 'mid']);
  });

  it('summarizes 24h game stats and movers', () => {
    activity.recordUser('g1', 'u1');
    activity.recordUser('g1', 'u2');
    economy.debit('u1', 100, 'bet', 'taixiu');
    economy.settleGame('u1', 100, 400, 'taixiu'); // net +300
    economy.debit('u2', 200, 'bet', 'slots');
    economy.settleGame('u2', 200, 0, 'slots'); // net -200

    const stats = reports.gameStats24h();
    expect(stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ game: 'taixiu', bets: 1, staked: 100 }),
        expect.objectContaining({ game: 'slots', bets: 1, staked: 200 }),
      ]),
    );

    const movers = reports.topMovers24h('g1');
    expect(movers.winner).toMatchObject({ userId: 'u1', net: 300 });
    expect(movers.loser).toMatchObject({ userId: 'u2', net: -200 });
  });
});
