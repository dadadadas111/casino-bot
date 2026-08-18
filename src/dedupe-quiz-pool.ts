import { cache, connectExternalServices, mongo } from './context.js';
import { fingerprint, isNearDuplicate } from './services/similarity.service.js';

/**
 * Clean near-duplicates out of the pool: pnpm dedupe-quiz [--apply]
 * Without --apply it only reports, so the deletions can be reviewed first.
 */
const apply = process.argv.includes('--apply');

interface Doc {
  key: string;
  question: string;
  answers: string[];
  correct: number;
  tier: string;
  timesServed: number;
}

async function main(): Promise<void> {
  await connectExternalServices();
  if (!mongo.available()) throw new Error('Mongo unavailable');

  const docs = (await mongo.questions().find({}).toArray()) as unknown as Doc[];
  const prints = docs.map((d) => ({ doc: d, print: fingerprint(d) }));

  // Greedy clustering: the first member becomes the keeper, the rest go.
  const keep: typeof prints = [];
  const remove: Array<{ doc: Doc; clashesWith: string }> = [];
  for (const item of prints) {
    const clash = keep.find((k) => isNearDuplicate(item.print, k.print));
    if (clash) remove.push({ doc: item.doc, clashesWith: clash.doc.question });
    else keep.push(item);
  }

  // Prefer keeping whichever of a pair has actually been played.
  console.log(`kho hiện tại: ${docs.length} câu`);
  console.log(`sẽ giữ:       ${keep.length}`);
  console.log(`sẽ xoá:       ${remove.length}`);
  const byTier: Record<string, number> = {};
  for (const k of keep) byTier[k.doc.tier] = (byTier[k.doc.tier] ?? 0) + 1;
  console.log('còn lại theo độ khó:', byTier);

  console.log('\n--- câu sẽ xoá (kèm câu nó trùng) ---');
  for (const r of remove.slice(0, Number(process.env.SHOW ?? 12))) {
    console.log(`  XOÁ: ${r.doc.question}`);
    console.log(`  vì trùng: ${r.clashesWith}\n`);
  }

  if (!apply) {
    console.log('(chạy thử, chưa xoá gì. Thêm --apply để thực hiện)');
  } else {
    const keys = remove.map((r) => r.doc.key);
    const delQ = await mongo.questions().deleteMany({ key: { $in: keys } });
    const delU = await mongo.usage().deleteMany({ key: { $in: keys } });
    console.log(`đã xoá ${delQ.deletedCount} câu và ${delU.deletedCount} bản ghi lượt dùng`);
  }
  await Promise.allSettled([mongo.close(), cache.close()]);
}

main().catch((e) => {
  console.error('[dedupe] thất bại:', e);
  process.exit(1);
});
