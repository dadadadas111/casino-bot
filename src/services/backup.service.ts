import { gzipSync } from 'node:zlib';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from '../db/database.js';
import { vnDay } from './economy.service.js';

/** Discord rejects larger uploads on a free guild; warn well before that. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface BackupFile {
  name: string;
  data: Buffer;
  rawBytes: number;
}

/**
 * Takes a consistent snapshot of the live database.
 *
 * VACUUM INTO is used rather than copying the file: with WAL enabled a plain
 * copy can catch a half-written page, while VACUUM INTO writes a clean, fully
 * checkpointed database even while the bot keeps playing.
 */
export class BackupService {
  constructor(private db: Db) {}

  snapshot(now: Date = new Date()): BackupFile {
    const tmp = join(tmpdir(), `casino-backup-${Date.now()}.db`);
    try {
      this.db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
      const raw = readFileSync(tmp);
      return {
        name: `casino-${vnDay(now).replace(/-/g, '')}.db.gz`,
        data: gzipSync(raw, { level: 9 }),
        rawBytes: raw.length,
      };
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  /** Rows per table, handy as a sanity line next to the file. */
  summary(): string {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    let rows = 0;
    for (const t of tables) {
      const r = this.db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get() as { c: number };
      rows += r.c;
    }
    return `${tables.length} bảng, ${rows.toLocaleString('vi-VN')} dòng`;
  }

  lastRunDay(): string | null {
    const row = this.db
      .prepare("SELECT value FROM bot_meta WHERE key = 'backup_last_day'")
      .get() as { value: string } | undefined;
    return row?.value ?? null;
  }

  markRun(now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO bot_meta (key, value) VALUES ('backup_last_day', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(vnDay(now));
  }
}
