import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import {
  EconomyService,
  HOSPITAL_DURATION_MS,
  JAIL_DURATION_MS,
  OFFENSE_RESET_MS,
  STARTING_BALANCE,
} from '../src/services/economy.service';
import { ItemsService } from '../src/services/items.service';
import { ProfileService } from '../src/services/profile.service';

let db: Db;
let economy: EconomyService;
let items: ItemsService;
let profiles: ProfileService;

const t0 = new Date('2026-08-13T10:00:00+07:00');

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  items = new ItemsService(db);
  profiles = new ProfileService(db);
});

describe('ProfileService', () => {
  it('creates a blank dossier for an unknown player', () => {
    const p = profiles.get('newbie');
    expect(p).toMatchObject({
      balance: STARTING_BALANCE,
      bank: 0,
      cash: 0,
      gamesPlayed: 0,
      jailTotal: 0,
      hospitalTotal: 0,
      spouse: null,
    });
    expect(p.games).toEqual([]);
    expect(p.items).toEqual([]);
  });

  it('breaks results down per game with the biggest win', () => {
    economy.debit('u1', 100, 'bet', 'taixiu');
    economy.settleGame('u1', 100, 400, 'taixiu');
    economy.debit('u1', 200, 'bet', 'taixiu');
    economy.settleGame('u1', 200, 0, 'taixiu');
    economy.debit('u1', 50, 'bet', 'slots');
    economy.settleGame('u1', 50, 0, 'slots');

    const p = profiles.get('u1');
    const taixiu = p.games.find((g) => g.game === 'taixiu')!;
    expect(taixiu).toMatchObject({ bets: 2, staked: 300, won: 400, biggestWin: 400 });
    expect(p.games.find((g) => g.game === 'slots')).toMatchObject({ bets: 1, staked: 50, won: 0 });
    expect(p.gamesPlayed).toBe(3);
  });

  it('counts lifetime jail and hospital visits even after the daily tally resets', () => {
    economy.jail('u1', JAIL_DURATION_MS, t0);
    economy.jail('u1', JAIL_DURATION_MS, t0);
    economy.hospitalize('u1', HOSPITAL_DURATION_MS, t0);
    const later = new Date(t0.getTime() + OFFENSE_RESET_MS + 1_000);
    economy.jail('u1', JAIL_DURATION_MS, later);

    expect(economy.offenseCount('u1', 'jail', later)).toBe(1); // daily tally rolled over
    const p = profiles.get('u1');
    expect(p.jailTotal).toBe(3);
    expect(p.hospitalTotal).toBe(1);
  });

  it('reports robbery tallies from both sides', () => {
    economy.credit('victim', 9_000, 'admin_add');
    economy.tryRob('thief', 'victim', t0, 0.1);
    const p = profiles.get('thief');
    expect(p.robsWon).toBe(1);
    expect(p.robLoot).toBe(1_500);
    expect(profiles.get('victim').robsSuffered).toBe(1);
  });

  it('shows marriage, inventory and lottery tickets', () => {
    economy.marry('a', 'b', t0);
    items.add('a', 'khien', 2);
    economy.debit('a', 100, 'bet', 'xoso');
    const p = profiles.get('a');
    expect(p.spouse).toBe('b');
    expect(p.marriedAt).not.toBeNull();
    expect(p.items).toEqual([{ item: 'khien', qty: 2 }]);
    expect(p.lotteryTickets).toBe(1);
  });
});
