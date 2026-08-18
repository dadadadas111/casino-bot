import { env } from './config/env.js';
import { cache, connectExternalServices, mongo, quizPool } from './context.js';

/**
 * One-off pool seeding: pnpm seed-quiz [count]
 * Batches are large on purpose; the cost per question drops sharply with size.
 */
const target = Number(process.argv[2] ?? 100);
const tier = process.argv[3] as 'easy' | 'medium' | 'hard' | undefined;
const BATCH = 50;

async function main(): Promise<void> {
  await connectExternalServices();
  if (!mongo.available()) throw new Error('Mongo unavailable, cannot seed');
  if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY missing');

  const before = (await quizPool.stats())!;
  console.log(`[seed] pool hien co ${before.total} cau`, before.byTier);

  let added = 0;
  while (added < target) {
    const want = Math.min(BATCH, target - added);
    const n = await quizPool.generateAndStore(want, tier);
    console.log(`[seed] batch xin ${want}, luu duoc ${n} cau moi`);
    if (n === 0) {
      console.warn('[seed] batch khong them duoc gi (co the trung het), dung lai');
      break;
    }
    added += n;
  }

  const after = (await quizPool.stats())!;
  console.log(`[seed] xong: ${before.total} -> ${after.total} cau`, after.byTier);
  await Promise.allSettled([mongo.close(), cache.close()]);
}

main().catch((error) => {
  console.error('[seed] that bai:', error);
  process.exit(1);
});
