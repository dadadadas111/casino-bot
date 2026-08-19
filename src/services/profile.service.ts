import type { Db } from '../db/database.js';

export interface GameRecord {
  game: string;
  bets: number;
  staked: number;
  won: number;
  biggestWin: number;
}

export interface FullProfile {
  userId: string;
  balance: number;
  bank: number;
  cash: number;
  rank: number;
  joinedAt: string;
  gamesPlayed: number;
  totalWon: number;
  totalLost: number;
  dailyStreak: number;
  jailTotal: number;
  hospitalTotal: number;
  spouse: string | null;
  marriedAt: string | null;
  games: GameRecord[];
  robsWon: number;
  robsSuffered: number;
  robLoot: number;
  lotteryTickets: number;
  weddingGifts: number;
  items: Array<{ item: string; qty: number }>;
}

/** Everything worth showing on a player's dossier, in one round of queries. */
export class ProfileService {
  constructor(private db: Db) {}

  get(userId: string, guildId: string | null = null): FullProfile {
    this.db.prepare('INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 1000)').run(userId);

    const user = this.db
      .prepare(
        `SELECT balance, bank_balance AS bank, cash, daily_streak AS streak, games_played AS games,
                total_won AS won, total_lost AS lost, created_at AS joined,
                jail_total AS jailTotal, hospital_total AS hospitalTotal,
                married_to AS spouse, married_at AS marriedAt,
                (SELECT COUNT(*) + 1 FROM users u2
                  WHERE u2.balance > u.balance
                    AND (? IS NULL OR EXISTS (
                          SELECT 1 FROM user_guilds g2
                          WHERE g2.user_id = u2.user_id AND g2.guild_id = ?))) AS rank
         FROM users u WHERE user_id = ?`,
      )
      .get(guildId, guildId, userId) as {
      balance: number;
      bank: number;
      cash: number;
      streak: number;
      games: number;
      won: number;
      lost: number;
      joined: string;
      jailTotal: number;
      hospitalTotal: number;
      spouse: string | null;
      marriedAt: string | null;
      rank: number;
    };

    const games = this.db
      .prepare(
        `SELECT meta AS game,
                SUM(CASE WHEN type='bet' THEN 1 ELSE 0 END) AS bets,
                COALESCE(SUM(CASE WHEN type='bet' THEN -amount ELSE 0 END),0) AS staked,
                COALESCE(SUM(CASE WHEN type='payout' THEN amount ELSE 0 END),0) AS won,
                COALESCE(MAX(CASE WHEN type='payout' THEN amount ELSE 0 END),0) AS biggestWin
         FROM transactions
         WHERE user_id = ? AND meta IS NOT NULL AND type IN ('bet','payout')
         GROUP BY meta ORDER BY bets DESC, won DESC`,
      )
      .all(userId) as GameRecord[];

    const counts = this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN type='rob_in' THEN 1 ELSE 0 END) AS robsWon,
           SUM(CASE WHEN type='rob_out' THEN 1 ELSE 0 END) AS robsSuffered,
           COALESCE(SUM(CASE WHEN type='rob_in' THEN amount ELSE 0 END),0) AS robLoot,
           SUM(CASE WHEN type='bet' AND meta='xoso' THEN 1 ELSE 0 END) AS lotteryTickets,
           COALESCE(SUM(CASE WHEN type='wedding_gift' AND amount > 0 THEN amount ELSE 0 END),0) AS weddingGifts
         FROM transactions WHERE user_id = ?`,
      )
      .get(userId) as {
      robsWon: number | null;
      robsSuffered: number | null;
      robLoot: number;
      lotteryTickets: number | null;
      weddingGifts: number;
    };

    const items = this.db
      .prepare('SELECT item, qty FROM user_items WHERE user_id = ? AND qty > 0 ORDER BY qty DESC')
      .all(userId) as Array<{ item: string; qty: number }>;

    return {
      userId,
      balance: user.balance,
      bank: user.bank,
      cash: user.cash,
      rank: user.rank,
      joinedAt: user.joined,
      gamesPlayed: user.games,
      totalWon: user.won,
      totalLost: user.lost,
      dailyStreak: user.streak,
      jailTotal: user.jailTotal,
      hospitalTotal: user.hospitalTotal,
      spouse: user.spouse,
      marriedAt: user.marriedAt,
      games,
      robsWon: counts.robsWon ?? 0,
      robsSuffered: counts.robsSuffered ?? 0,
      robLoot: counts.robLoot,
      lotteryTickets: counts.lotteryTickets ?? 0,
      weddingGifts: counts.weddingGifts,
      items,
    };
  }
}
