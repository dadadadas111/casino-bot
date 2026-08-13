import type { Db } from '../db/database.js';

export interface BuffDef {
  key: string;
  name: string;
  emoji: string;
  durationMs: number;
  desc: string;
}

export const LUCKY_BONUS_RATE = 0.1;

export const BUFFS: Record<string, BuffDef> = {
  mayman: {
    key: 'mayman',
    name: 'Bùa may mắn',
    emoji: '🍀',
    durationMs: 60 * 60 * 1000,
    desc: `Mọi ván thắng được cộng thêm ${LUCKY_BONUS_RATE * 100}% tiền lời, kéo dài 1 giờ`,
  },
};

/** Timed buffs; expiry is checked on read so no cleanup job is needed. */
export class BuffService {
  constructor(private db: Db) {}

  /** (Re)start a buff; stacking extends from now, never doubles the rate. */
  activate(userId: string, buff: string, now: Date = new Date()): Date {
    const def = BUFFS[buff];
    const current = this.activeUntil(userId, buff, now);
    const base = current ?? now;
    const expiresAt = new Date(base.getTime() + def.durationMs);
    this.db
      .prepare(
        `INSERT INTO user_buffs (user_id, buff, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id, buff) DO UPDATE SET expires_at = excluded.expires_at`,
      )
      .run(userId, buff, expiresAt.toISOString());
    return expiresAt;
  }

  activeUntil(userId: string, buff: string, now: Date = new Date()): Date | null {
    const row = this.db
      .prepare('SELECT expires_at FROM user_buffs WHERE user_id = ? AND buff = ?')
      .get(userId, buff) as { expires_at: string } | undefined;
    if (!row) return null;
    const until = new Date(row.expires_at);
    return until.getTime() > now.getTime() ? until : null;
  }

  activeList(userId: string, now: Date = new Date()): Array<{ buff: string; expiresAt: Date }> {
    const rows = this.db
      .prepare('SELECT buff, expires_at FROM user_buffs WHERE user_id = ?')
      .all(userId) as Array<{ buff: string; expires_at: string }>;
    return rows
      .map((r) => ({ buff: r.buff, expiresAt: new Date(r.expires_at) }))
      .filter((r) => r.expiresAt.getTime() > now.getTime());
  }
}
