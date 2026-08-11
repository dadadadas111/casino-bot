import { env } from './config/env.js';
import { createDb } from './db/database.js';
import { EconomyService } from './services/economy.service.js';
import { QuizHistoryStore } from './services/quiz-history.service.js';

export const db = createDb(env.DB_PATH);
export const economy = new EconomyService(db);
export const quizHistory = new QuizHistoryStore(db);
