import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_daily TEXT,
  last_work TEXT,
  last_trieuphu TEXT,
  total_won INTEGER NOT NULL DEFAULT 0,
  total_lost INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance DESC);

CREATE TABLE IF NOT EXISTS quiz_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guild_prefixes (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  day TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lottery_day ON lottery_tickets(day);

CREATE TABLE IF NOT EXISTS lottery_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_guilds (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS channel_activity (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, channel_id, day)
);

CREATE TABLE IF NOT EXISTS report_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  hour INTEGER NOT NULL DEFAULT 10,
  channel_id TEXT,
  tag_everyone INTEGER NOT NULL DEFAULT 1,
  last_sent_day TEXT,
  patch_enabled INTEGER NOT NULL DEFAULT 1,
  patch_channel_id TEXT,
  last_patch_version TEXT
);

CREATE TABLE IF NOT EXISTS user_items (
  user_id TEXT NOT NULL,
  item TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item)
);

CREATE TABLE IF NOT EXISTS figurines (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎎',
  married INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_luck (
  user_id TEXT PRIMARY KEY,
  factor REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS user_buffs (
  user_id TEXT NOT NULL,
  buff TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (user_id, buff)
);

CREATE TABLE IF NOT EXISTS topup_requests (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  guild_id TEXT,
  channel_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_topup_user ON topup_requests(user_id, status);

CREATE TABLE IF NOT EXISTS sepay_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  amount INTEGER NOT NULL,
  content TEXT,
  matched_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function createDb(dbPath: string): Db {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Additive migrations for databases created before a column existed. */
function migrate(db: Db): void {
  const addColumn = (table: string, name: string, ddl: string): void => {
    const exists = db
      .prepare(`SELECT COUNT(*) AS n FROM pragma_table_info('${table}') WHERE name = ?`)
      .get(name) as { n: number };
    if (!exists.n) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  };
  const ensureColumn = (name: string, ddl = 'TEXT'): void => addColumn('users', name, ddl);

  addColumn('topup_requests', 'guild_id', 'TEXT');
  addColumn('topup_requests', 'channel_id', 'TEXT');
  addColumn('report_config', 'patch_enabled', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('report_config', 'patch_channel_id', 'TEXT');
  addColumn('report_config', 'last_patch_version', 'TEXT');

  ensureColumn('last_work');
  ensureColumn('last_trieuphu');
  ensureColumn('cash', 'INTEGER NOT NULL DEFAULT 0'); // premium currency, unit = VND
  ensureColumn('bank_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('jail_until');
  ensureColumn('hospital_until');
  ensureColumn('jail_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('jail_count_at');
  ensureColumn('hospital_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('hospital_count_at');
  // Lifetime tallies; the *_count columns above roll over every day.
  ensureColumn('jail_total', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('hospital_total', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('last_rob');
  ensureColumn('married_to');
  ensureColumn('married_at');
}
