import { env } from './config/env.js';
import { createDb } from './db/database.js';
import { EconomyService } from './services/economy.service.js';

export const db = createDb(env.DB_PATH);
export const economy = new EconomyService(db);
