import { beforeEach, describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { BackupService, MAX_UPLOAD_BYTES } from '../src/services/backup.service';

let db: Db;
let backups: BackupService;
let economy: EconomyService;

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  backups = new BackupService(db);
});

describe('BackupService', () => {
  it('produces a restorable snapshot of the live data', () => {
    economy.credit('u1', 5_000, 'admin_add');
    economy.debit('u1', 1_200, 'bet', 'taixiu');

    const file = backups.snapshot(new Date('2026-08-18T10:00:00+07:00'));
    expect(file.name).toBe('casino-20260818.db.gz');
    expect(file.data.length).toBeLessThan(file.rawBytes); // gzip actually helped

    // The real test of a backup: open it and read the balance back.
    const restored = new Database(gunzipSync(file.data));
    const row = restored.prepare('SELECT balance FROM users WHERE user_id = ?').get('u1') as {
      balance: number;
    };
    expect(row.balance).toBe(economy.getBalance('u1'));
    const tx = restored.prepare('SELECT COUNT(*) AS c FROM transactions').get() as { c: number };
    expect(tx.c).toBeGreaterThan(0);
    restored.close();
  });

  it('stays far below the upload limit at realistic sizes', () => {
    for (let i = 0; i < 200; i++) economy.credit(`user-${i}`, 1_000, 'admin_add');
    expect(backups.snapshot().data.length).toBeLessThan(MAX_UPLOAD_BYTES);
  });

  it('summarises table and row counts', () => {
    economy.credit('u1', 100, 'admin_add');
    expect(backups.summary()).toMatch(/\d+ bảng, [\d.]+ dòng/);
  });

  it('records the day it last ran so it fires once daily', () => {
    const day = new Date('2026-08-18T03:30:00+07:00');
    expect(backups.lastRunDay()).toBeNull();
    backups.markRun(day);
    expect(backups.lastRunDay()).toBe('2026-08-18');
    backups.markRun(new Date('2026-08-19T03:30:00+07:00'));
    expect(backups.lastRunDay()).toBe('2026-08-19');
  });
});
