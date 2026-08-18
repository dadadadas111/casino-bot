import { MongoClient, type Collection, type Db as MongoDb } from 'mongodb';

export interface PoolQuestion {
  key: string; // normalized text, unique: stops the pool filling with near-duplicates
  question: string;
  answers: string[];
  correct: number;
  tier: 'easy' | 'medium' | 'hard';
  createdAt: Date;
  timesServed: number;
}

export interface QuizUsage {
  guildId: string;
  key: string;
  usedAt: Date;
}

/** Normalized form used as the dedup key. */
export function questionKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Optional document store for the shared quiz pool. Everything degrades to
 * "unavailable" rather than throwing, so a Mongo outage falls back to the
 * built-in static question bank.
 */
export class MongoService {
  private client: MongoClient | null = null;
  private db: MongoDb | null = null;

  async connect(uri: string | undefined, dbName = 'casino'): Promise<void> {
    if (!uri) {
      console.log('[mongo] MONGO_URI not set, quiz pool disabled');
      return;
    }
    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10_000,
        retryWrites: true,
      });
      await this.client.connect();
      this.db = this.client.db(dbName);
      await this.ensureIndexes();
      console.log(`[mongo] Connected, pool has ${await this.questions().countDocuments()} questions`);
    } catch (error) {
      console.warn('[mongo] Connect failed, quiz pool disabled:', String(error));
      this.client = null;
      this.db = null;
    }
  }

  available(): boolean {
    return this.db !== null;
  }

  questions(): Collection<PoolQuestion> {
    return this.db!.collection<PoolQuestion>('quiz_questions');
  }

  usage(): Collection<QuizUsage> {
    return this.db!.collection<QuizUsage>('quiz_usage');
  }

  private async ensureIndexes(): Promise<void> {
    await this.questions().createIndex({ key: 1 }, { unique: true });
    await this.questions().createIndex({ tier: 1 });
    await this.usage().createIndex({ guildId: 1, key: 1 }, { unique: true });
    await this.usage().createIndex({ guildId: 1 });
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
