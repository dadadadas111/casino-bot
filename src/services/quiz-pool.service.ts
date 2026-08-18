import type { CacheService } from './redis.service.js';
import { type MongoService, type PoolQuestion, questionKey } from './mongo.service.js';
import { generateQuestionBatch } from './quiz-ai.service.js';
import { rejectDuplicates } from './similarity.service.js';
import { type GameQuestion, toGameQuestions } from './trieuphu.service.js';
import type { QuizTier } from '../data/trieuphu-questions.js';

/** Questions handed out per game, by difficulty. */
export const PER_GAME: Record<QuizTier, number> = { easy: 5, medium: 5, hard: 5 };
/** Refill once a tier can serve fewer than this many further games. */
export const REFILL_GAMES_LEFT = 2;
export const REFILL_BATCH = 50;
/**
 * Spend guards. Recycling means a game never fails for lack of questions, so
 * refills are a quality nicety, not a necessity: at most one per hour across
 * the whole bot, and none at all once the pool is comfortably large.
 */
export const REFILL_COOLDOWN_SECONDS = 60 * 60;
export const POOL_MAX = 1_000;
const REFILL_RECENT = 'casino:quiz:refill:recent';
/** How many times the needed count to consider before shuffling. */
export const CANDIDATE_WINDOW = 3;
const REFILL_LOCK = 'casino:quiz:refill';
const REFILL_LOCK_TTL = 300;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface PoolStats {
  total: number;
  byTier: Record<string, number>;
}

/**
 * A pool of AI-written questions shared by every server.
 *
 * Cost control, in order of impact:
 *  - questions are global, so each new server reuses the whole pool for free;
 *  - refills come in batches of 50 rather than one game's worth of 15;
 *  - a refill only fires when a guild is genuinely about to see repeats;
 *  - a lock stops two guilds paying for the same batch at the same time.
 */
export class QuizPoolService {
  constructor(
    private mongo: MongoService,
    private cache: CacheService,
    private apiKey: string | undefined,
  ) {}

  available(): boolean {
    return this.mongo.available();
  }

  /** Keys this guild has already been served. */
  private async seenKeys(guildId: string): Promise<string[]> {
    const rows = await this.mongo
      .usage()
      .find({ guildId }, { projection: { key: 1, _id: 0 } })
      .toArray();
    return rows.map((r) => r.key);
  }

  /**
   * Candidates for one tier, stalest first: questions this guild has never
   * seen sort ahead of ones it has, and among those seen the oldest wins.
   * A window of several times the needed count keeps successive games from
   * being identical while still respecting the ordering.
   */
  private async staleCandidates(
    guildId: string,
    tier: QuizTier,
    count: number,
  ): Promise<PoolQuestion[]> {
    return this.mongo
      .questions()
      .aggregate<PoolQuestion>([
        { $match: { tier } },
        {
          $lookup: {
            from: 'quiz_usage',
            let: { k: '$key' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$key', '$$k'] }, { $eq: ['$guildId', guildId] }] } } },
              { $project: { lastUsedAt: 1, _id: 0 } },
            ],
            as: 'seen',
          },
        },
        // Never-seen questions get epoch 0 so they always sort first.
        { $addFields: { lastUsedAt: { $ifNull: [{ $first: '$seen.lastUsedAt' }, new Date(0)] } } },
        { $sort: { lastUsedAt: 1 } },
        { $limit: count * CANDIDATE_WINDOW },
        { $project: { seen: 0 } },
      ])
      .toArray();
  }

  /**
   * Draw a full game for a guild. Questions are recycled rather than burned:
   * once the pool has been through, the ones untouched longest come back.
   * Returns null only when the pool genuinely cannot fill a tier.
   */
  async drawGame(guildId: string): Promise<GameQuestion[] | null> {
    if (!this.available()) return null;
    try {
      const picked: PoolQuestion[] = [];

      for (const [tier, count] of Object.entries(PER_GAME) as Array<[QuizTier, number]>) {
        const candidates = await this.staleCandidates(guildId, tier, count);
        if (candidates.length < count) return null;
        picked.push(...shuffled(candidates).slice(0, count));
      }

      const now = new Date();
      await this.mongo.usage().bulkWrite(
        picked.map((q) => ({
          updateOne: {
            filter: { guildId, key: q.key },
            update: { $set: { lastUsedAt: now }, $inc: { timesUsed: 1 } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      await this.mongo
        .questions()
        .updateMany({ key: { $in: picked.map((q) => q.key) } }, { $inc: { timesServed: 1 } });

      // Check supply after serving, never before: the game must not wait.
      void this.refillIfLow(guildId).catch((e) => console.warn('[quiz-pool] refill:', String(e)));

      return toGameQuestions(picked);
    } catch (error) {
      console.warn('[quiz-pool] draw failed, falling back to bank:', String(error));
      return null;
    }
  }

  /** Unseen questions per tier for one guild. */
  async unseenByTier(guildId: string): Promise<Record<string, number>> {
    const seen = await this.seenKeys(guildId);
    const out: Record<string, number> = {};
    for (const tier of Object.keys(PER_GAME) as QuizTier[]) {
      out[tier] = await this.mongo.questions().countDocuments({ tier, key: { $nin: seen } });
    }
    return out;
  }

  /**
   * Top the pool up when a guild is close to seeing repeats. Guarded three
   * ways so a guild that has exhausted the pool cannot trigger a purchase on
   * every single game.
   */
  async refillIfLow(guildId: string): Promise<boolean> {
    if (!this.available() || !this.apiKey) return false;

    // 1. Big enough pools recycle comfortably; stop buying.
    const total = await this.mongo.questions().countDocuments();
    if (total >= POOL_MAX) return false;

    // 2. At most one refill per hour, bot-wide.
    if (await this.cache.get<number>(REFILL_RECENT)) return false;

    const unseen = await this.unseenByTier(guildId);
    // Buy only the difficulty that is running out, not a balanced batch we
    // partly do not need.
    const shortest = (Object.entries(PER_GAME) as Array<[QuizTier, number]>)
      .filter(([tier, perGame]) => (unseen[tier] ?? 0) < perGame * REFILL_GAMES_LEFT)
      .sort((a, b) => (unseen[a[0]] ?? 0) - (unseen[b[0]] ?? 0))[0];
    if (!shortest) return false;
    const focusTier = shortest[0];

    // 3. And only one generation running at a time.
    if (!(await this.cache.acquireLock(REFILL_LOCK, REFILL_LOCK_TTL))) {
      console.log('[quiz-pool] refill already running elsewhere, skipping');
      return false;
    }
    try {
      await this.cache.set(REFILL_RECENT, Date.now(), REFILL_COOLDOWN_SECONDS);
      const added = await this.generateAndStore(REFILL_BATCH, focusTier);
      console.log(
        `[quiz-pool] refilled ${added} "${focusTier}" question(s) (guild ${guildId} was low)`,
      );
      return added > 0;
    } finally {
      await this.cache.releaseLock(REFILL_LOCK);
    }
  }

  /**
   * Ask the model for a batch and keep only what is genuinely new. The unique
   * index on `key` does the deduplication, so a repeat costs storage, not a
   * corrupted pool.
   */
  async generateAndStore(count: number, focusTier?: QuizTier): Promise<number> {
    if (!this.available() || !this.apiKey) return 0;
    // A small sample of existing questions is enough to steer away from
    // repeats; sending the whole pool would blow up the prompt cost.
    const sample = await this.mongo
      .questions()
      .aggregate<PoolQuestion>([{ $sample: { size: 25 } }, { $project: { question: 1, _id: 0 } }])
      .toArray();

    const generated = await generateQuestionBatch(
      this.apiKey,
      count,
      sample.map((q) => q.question),
      focusTier,
    );
    if (!generated) return 0;

    // The unique index only stops identical text; a reworded repeat of the
    // same fact needs comparing content words against the whole pool.
    const existing = await this.mongo
      .questions()
      .find({}, { projection: { question: 1, answers: 1, correct: 1, _id: 0 } })
      .toArray();
    const { kept, dropped } = rejectDuplicates(generated, existing);
    if (dropped.length > 0) {
      console.log(`[quiz-pool] bỏ ${dropped.length}/${generated.length} câu trùng ý với kho`);
    }
    if (kept.length === 0) return 0;

    const docs: PoolQuestion[] = kept.map((q) => ({
      key: questionKey(q.question),
      question: q.question,
      answers: q.answers,
      correct: q.correct,
      tier: q.tier,
      createdAt: new Date(),
      timesServed: 0,
    }));

    try {
      const res = await this.mongo.questions().insertMany(docs, { ordered: false });
      return res.insertedCount;
    } catch (error) {
      // Duplicate keys are expected: the unique index is doing its job. The
      // driver reports the partial success on the error itself.
      const e = error as { insertedCount?: number; result?: { insertedCount?: number } };
      return e.insertedCount ?? e.result?.insertedCount ?? 0;
    }
  }

  async stats(): Promise<PoolStats | null> {
    if (!this.available()) return null;
    const byTier: Record<string, number> = {};
    for (const tier of Object.keys(PER_GAME) as QuizTier[]) {
      byTier[tier] = await this.mongo.questions().countDocuments({ tier });
    }
    return { total: await this.mongo.questions().countDocuments(), byTier };
  }
}
