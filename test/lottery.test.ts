import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService, STARTING_BALANCE } from '../src/services/economy.service';
import {
  JACKPOT_SEED,
  LotteryService,
  MAX_TICKETS_PER_DAY,
  POT_PER_TICKET,
  TICKET_PRICE,
  drawDayFor,
} from '../src/services/lottery.service';

let db: Db;
let economy: EconomyService;
let lottery: LotteryService;

// 10:00 VN on Aug 11 (before the 21h draw)
const morning = new Date('2026-08-11T10:00:00+07:00');
const lateEvening = new Date('2026-08-11T21:05:00+07:00');

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  lottery = new LotteryService(db, economy);
});

describe('drawDayFor', () => {
  it('assigns tickets before 21h VN to the same day, after to the next day', () => {
    expect(drawDayFor(new Date('2026-08-11T20:59:00+07:00'))).toBe('2026-08-11');
    expect(drawDayFor(new Date('2026-08-11T21:01:00+07:00'))).toBe('2026-08-12');
  });
});

describe('buy', () => {
  it('debits the price and grows the jackpot', () => {
    const result = lottery.buy('u1', 68, 'g1', 'c1', morning);
    expect(result).toMatchObject({ ok: true, drawDay: '2026-08-11', myTickets: 1 });
    expect(result.jackpot).toBe(JACKPOT_SEED + POT_PER_TICKET);
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE - TICKET_PRICE);
  });

  it('rejects invalid numbers and enforces the per-day ticket cap', () => {
    expect(lottery.buy('u1', 100, 'g1', 'c1', morning).error).toBe('invalid_number');
    expect(lottery.buy('u1', -1, 'g1', 'c1', morning).error).toBe('invalid_number');
    for (let i = 0; i < MAX_TICKETS_PER_DAY; i++) {
      expect(lottery.buy('u1', i, 'g1', 'c1', morning).ok).toBe(true);
    }
    expect(lottery.buy('u1', 50, 'g1', 'c1', morning).error).toBe('max_tickets');
  });

  it('rejects purchases the user cannot afford', () => {
    economy.debit('u1', STARTING_BALANCE - 50, 'bet');
    expect(lottery.buy('u1', 7, 'g1', 'c1', morning).error).toBe('insufficient');
  });
});

describe('pendingDrawDay', () => {
  it('is null before the draw hour and set after', () => {
    lottery.buy('u1', 7, 'g1', 'c1', morning);
    expect(lottery.pendingDrawDay(morning)).toBeNull();
    expect(lottery.pendingDrawDay(lateEvening)).toBe('2026-08-11');
  });

  it('surfaces missed past days (bot downtime) even before the draw hour', () => {
    lottery.buy('u1', 7, 'g1', 'c1', morning);
    const nextMorning = new Date('2026-08-12T08:00:00+07:00');
    expect(lottery.pendingDrawDay(nextMorning)).toBe('2026-08-11');
  });
});

describe('draw', () => {
  it('splits the jackpot by ticket count and reseeds', () => {
    lottery.buy('u1', 7, 'g1', 'c1', morning); // 1 winning ticket
    lottery.buy('u2', 7, 'g1', 'c2', morning); // 3 winning tickets
    lottery.buy('u2', 7, 'g1', 'c2', morning);
    lottery.buy('u2', 7, 'g1', 'c2', morning);
    const jackpot = lottery.getJackpot(); // 5000 + 4*80 = 5320

    const result = lottery.draw('2026-08-11', 7);
    expect(result.number).toBe(7);
    expect(result.winners).toHaveLength(2);
    const u1 = result.winners.find((w) => w.userId === 'u1')!;
    const u2 = result.winners.find((w) => w.userId === 'u2')!;
    expect(u1.share).toBe(Math.floor(jackpot / 4));
    expect(u2.share).toBe(Math.floor((jackpot * 3) / 4));
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE - TICKET_PRICE + u1.share);
    expect(lottery.getJackpot()).toBe(JACKPOT_SEED);
    expect(lottery.pendingDrawDay(lateEvening)).toBeNull(); // tickets consumed
  });

  it('rolls the jackpot when nobody wins', () => {
    lottery.buy('u1', 7, 'g1', 'c1', morning);
    const before = lottery.getJackpot();
    const result = lottery.draw('2026-08-11', 99);
    expect(result.winners).toHaveLength(0);
    expect(result.jackpotAfter).toBe(before);
    expect(economy.getProfile('u1').totalLost).toBe(TICKET_PRICE);
  });

  it('reports the latest channel per guild for announcements', () => {
    lottery.buy('u1', 1, 'g1', 'c1', morning);
    lottery.buy('u2', 2, 'g1', 'c9', morning); // later channel wins for g1
    lottery.buy('u3', 3, 'g2', 'c5', morning);
    const result = lottery.draw('2026-08-11', 50);
    expect(result.announceTargets).toEqual(
      expect.arrayContaining([
        { guildId: 'g1', channelId: 'c9' },
        { guildId: 'g2', channelId: 'c5' },
      ]),
    );
    expect(result.announceTargets).toHaveLength(2);
  });
});
