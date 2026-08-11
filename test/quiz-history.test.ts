import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { QuizHistoryStore } from '../src/services/quiz-history.service';

let db: Db;
let store: QuizHistoryStore;

beforeEach(() => {
  db = createDb(':memory:');
  store = new QuizHistoryStore(db);
});

describe('QuizHistoryStore', () => {
  it('returns recent questions newest first', () => {
    store.record(['câu 1', 'câu 2']);
    store.record(['câu 3']);
    expect(store.recent(2)).toEqual(['câu 3', 'câu 2']);
  });

  it('keeps at most 300 questions', () => {
    for (let batch = 0; batch < 31; batch++) {
      store.record(Array.from({ length: 10 }, (_, i) => `batch ${batch} câu ${i}`));
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM quiz_history').get() as { n: number };
    expect(count.n).toBe(300);
    expect(store.recent(1)).toEqual(['batch 30 câu 9']);
  });
});
