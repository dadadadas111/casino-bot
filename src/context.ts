import { env } from './config/env.js';
import { createDb } from './db/database.js';
import { EconomyService } from './services/economy.service.js';
import { QuizHistoryStore } from './services/quiz-history.service.js';
import { PrefixStore } from './services/prefix.service.js';
import { LotteryService } from './services/lottery.service.js';
import { ActivityService } from './services/activity.service.js';
import { ReportService } from './services/report.service.js';
import { CashService } from './services/cash.service.js';
import { ItemsService, loadShopCatalog } from './services/items.service.js';
import { ConfigService } from './services/config.service.js';
import { GuildItemsService } from './services/guild-items.service.js';
import { BuffService } from './services/buff.service.js';
import { TopupService } from './services/topup.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { ProfileService } from './services/profile.service.js';
import { LuckService } from './services/luck.service.js';
import { FigurineService } from './services/figurine.service.js';
import { CacheService } from './services/redis.service.js';
import { MongoService } from './services/mongo.service.js';
import { QuizPoolService, QuizReviewQueue } from './services/quiz-pool.service.js';
import { GifCache } from './services/gif-cache.service.js';
import { BackupService } from './services/backup.service.js';
import { AssetsService } from './services/assets.service.js';
import { LoanService } from './services/loan.service.js';
import { QuestService } from './services/quest.service.js';

export const db = createDb(env.DB_PATH);
// Seed the shop catalog into the DB (idempotent) and load it into cache.
loadShopCatalog(db);
export const config = new ConfigService(db);
export const buffs = new BuffService(db);
export const assets = new AssetsService(db);
export const economy = new EconomyService(db, buffs, assets);
export const quizHistory = new QuizHistoryStore(db);
export const prefixes = new PrefixStore(db);
export const lottery = new LotteryService(db, economy);
export const loans = new LoanService(db, economy, assets, lottery);
export const quests = new QuestService(db, economy);

// Income tax feeds the lottery pot instead of vanishing.
economy.setTreasury((amount) => lottery.addToJackpot(amount));
// Every settled game feeds the quest tracker (real bets only).
economy.setGameHook((userId, bet, payout, game) => quests.recordGame(userId, bet, payout, game));
economy.setLifeHook((userId, event) => quests.record(userId, [event]));
export const activity = new ActivityService(db);
export const reports = new ReportService(db);
export const cash = new CashService(db);
export const items = new ItemsService(db);
export const guildItems = new GuildItemsService(db);
export const topups = new TopupService(db, cash);
export const dashboard = new DashboardService(db);
export const profiles = new ProfileService(db);
export const luck = new LuckService(db);
export const figurines = new FigurineService(db);
export const backups = new BackupService(db);

// External services connect lazily at startup; every consumer treats them as
// optional so the bot boots fine when they are unreachable.
export const cache = new CacheService();
export const mongo = new MongoService();
export const quizPool = new QuizPoolService(mongo, cache, env.DEEPSEEK_API_KEY);
export const gifs = new GifCache(cache);
export const quizReview = new QuizReviewQueue(mongo);

export async function connectExternalServices(): Promise<void> {
  await Promise.all([cache.connect(env.REDIS_URL), mongo.connect(env.MONGO_URI, env.MONGO_DB)]);
}
