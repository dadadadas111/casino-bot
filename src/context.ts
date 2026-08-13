import { env } from './config/env.js';
import { createDb } from './db/database.js';
import { EconomyService } from './services/economy.service.js';
import { QuizHistoryStore } from './services/quiz-history.service.js';
import { PrefixStore } from './services/prefix.service.js';
import { LotteryService } from './services/lottery.service.js';
import { ActivityService } from './services/activity.service.js';
import { ReportService } from './services/report.service.js';

export const db = createDb(env.DB_PATH);
export const economy = new EconomyService(db);
export const quizHistory = new QuizHistoryStore(db);
export const prefixes = new PrefixStore(db);
export const lottery = new LotteryService(db, economy);
export const activity = new ActivityService(db);
export const reports = new ReportService(db);
