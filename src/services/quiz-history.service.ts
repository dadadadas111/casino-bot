import type { Db } from '../db/database.js';

const KEEP_LAST = 300;

/** Remembers recently asked quiz questions so new games avoid repeats. */
export class QuizHistoryStore {
  constructor(private db: Db) {}

  recent(limit: number): string[] {
    const rows = this.db
      .prepare('SELECT question FROM quiz_history ORDER BY id DESC LIMIT ?')
      .all(limit) as Array<{ question: string }>;
    return rows.map((r) => r.question);
  }

  record(questions: string[]): void {
    const run = this.db.transaction(() => {
      const insert = this.db.prepare('INSERT INTO quiz_history (question) VALUES (?)');
      for (const q of questions) insert.run(q);
      this.db
        .prepare(
          `DELETE FROM quiz_history WHERE id NOT IN (
             SELECT id FROM quiz_history ORDER BY id DESC LIMIT ?
           )`,
        )
        .run(KEEP_LAST);
    });
    run();
  }
}
