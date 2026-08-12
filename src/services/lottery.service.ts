import type { Db } from '../db/database.js';
import { EconomyService, vnDay } from './economy.service.js';

export const TICKET_PRICE = 100;
export const MAX_TICKETS_PER_DAY = 5;
export const POT_PER_TICKET = 80; // 80% of the ticket feeds the pot (house edge 20%)
export const JACKPOT_SEED = 5_000;
export const DRAW_HOUR = 21; // Vietnam time

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  hour12: false,
});

export function vnHour(now: Date): number {
  return Number(hourFmt.format(now));
}

/** Tickets bought after the draw hour belong to the next day's draw. */
export function drawDayFor(now: Date): string {
  return vnHour(now) < DRAW_HOUR
    ? vnDay(now)
    : vnDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

export type BuyError = 'invalid_number' | 'max_tickets' | 'insufficient';

export interface BuyResult {
  ok: boolean;
  error?: BuyError;
  drawDay?: string;
  jackpot?: number;
  myTickets?: number;
}

export interface DrawWinner {
  userId: string;
  tickets: number;
  share: number;
}

export interface DrawResult {
  day: string;
  number: number;
  winners: DrawWinner[];
  jackpotPaid: number;
  jackpotAfter: number;
  totalTickets: number;
  announceTargets: Array<{ guildId: string; channelId: string }>;
}

interface TicketRow {
  id: number;
  user_id: string;
  number: number;
  guild_id: string;
  channel_id: string;
}

export class LotteryService {
  constructor(
    private db: Db,
    private economy: EconomyService,
  ) {
    this.db
      .prepare("INSERT OR IGNORE INTO lottery_meta (key, value) VALUES ('jackpot', ?)")
      .run(String(JACKPOT_SEED));
  }

  getJackpot(): number {
    const row = this.db.prepare("SELECT value FROM lottery_meta WHERE key = 'jackpot'").get() as {
      value: string;
    };
    return Number(row.value);
  }

  private setJackpot(value: number): void {
    this.db.prepare("UPDATE lottery_meta SET value = ? WHERE key = 'jackpot'").run(String(value));
  }

  buy(
    userId: string,
    number: number,
    guildId: string,
    channelId: string,
    now: Date = new Date(),
  ): BuyResult {
    if (!Number.isInteger(number) || number < 0 || number > 99) {
      return { ok: false, error: 'invalid_number' };
    }
    const day = drawDayFor(now);
    const count = (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM lottery_tickets WHERE user_id = ? AND day = ?')
        .get(userId, day) as { n: number }
    ).n;
    if (count >= MAX_TICKETS_PER_DAY) {
      return { ok: false, error: 'max_tickets' };
    }
    if (!this.economy.debit(userId, TICKET_PRICE, 'bet', 'xoso')) {
      return { ok: false, error: 'insufficient' };
    }
    const run = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO lottery_tickets (user_id, number, day, guild_id, channel_id) VALUES (?, ?, ?, ?, ?)',
        )
        .run(userId, number, day, guildId, channelId);
      this.setJackpot(this.getJackpot() + POT_PER_TICKET);
    });
    run();
    return { ok: true, drawDay: day, jackpot: this.getJackpot(), myTickets: count + 1 };
  }

  info(
    userId: string,
    now: Date = new Date(),
  ): { jackpot: number; drawDay: string; myNumbers: number[]; totalTickets: number } {
    const day = drawDayFor(now);
    const myNumbers = (
      this.db
        .prepare(
          'SELECT number FROM lottery_tickets WHERE user_id = ? AND day = ? ORDER BY number',
        )
        .all(userId, day) as Array<{ number: number }>
    ).map((r) => r.number);
    const totalTickets = (
      this.db.prepare('SELECT COUNT(*) AS n FROM lottery_tickets WHERE day = ?').get(day) as {
        n: number;
      }
    ).n;
    return { jackpot: this.getJackpot(), drawDay: day, myNumbers, totalTickets };
  }

  /**
   * The earliest day whose draw is owed: any past day with tickets, or today
   * once the draw hour has passed. Survives restarts and downtime.
   */
  pendingDrawDay(now: Date = new Date()): string | null {
    const today = vnDay(now);
    const row = this.db
      .prepare(
        'SELECT MIN(day) AS day FROM lottery_tickets WHERE day < ? OR (day = ? AND ? >= ?)',
      )
      .get(today, today, vnHour(now), DRAW_HOUR) as { day: string | null };
    return row.day;
  }

  draw(day: string, winningNumber: number = Math.floor(Math.random() * 100)): DrawResult {
    const tickets = this.db
      .prepare(
        'SELECT id, user_id, number, guild_id, channel_id FROM lottery_tickets WHERE day = ? ORDER BY id',
      )
      .all(day) as TicketRow[];
    const jackpot = this.getJackpot();

    const winTickets = tickets.filter((t) => t.number === winningNumber);
    const winners: DrawWinner[] = [];
    if (winTickets.length > 0) {
      const byUser = new Map<string, number>();
      for (const t of winTickets) byUser.set(t.user_id, (byUser.get(t.user_id) ?? 0) + 1);
      for (const [userId, count] of byUser) {
        winners.push({
          userId,
          tickets: count,
          share: Math.floor((jackpot * count) / winTickets.length),
        });
      }
    }

    // Settle stats once per participant (spent vs won).
    const spentByUser = new Map<string, number>();
    for (const t of tickets) {
      spentByUser.set(t.user_id, (spentByUser.get(t.user_id) ?? 0) + TICKET_PRICE);
    }
    for (const [userId, spent] of spentByUser) {
      const share = winners.find((w) => w.userId === userId)?.share ?? 0;
      this.economy.settleGame(userId, spent, share, 'xoso');
    }

    const jackpotPaid = winners.reduce((sum, w) => sum + w.share, 0);
    const jackpotAfter = winTickets.length > 0 ? JACKPOT_SEED : jackpot;
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM lottery_tickets WHERE day = ?').run(day);
      this.setJackpot(jackpotAfter);
    });
    run();

    // Latest channel per guild for announcements.
    const channelByGuild = new Map<string, string>();
    for (const t of tickets) channelByGuild.set(t.guild_id, t.channel_id);
    const announceTargets = [...channelByGuild.entries()].map(([guildId, channelId]) => ({
      guildId,
      channelId,
    }));

    return {
      day,
      number: winningNumber,
      winners,
      jackpotPaid,
      jackpotAfter,
      totalTickets: tickets.length,
      announceTargets,
    };
  }
}
