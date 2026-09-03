import type { Db } from '../db/database.js';

export const FIGURINE_EMOJIS = ['🎎', '🧸', '🪆', '🗿', '👼', '🤖', '👻', '🐰', '🐧', '🌸'] as const;
export const MAX_NAME_LENGTH = 32;

export interface Figurine {
  userId: string;
  name: string;
  emoji: string;
  married: boolean;
  createdAt: string;
  avatar: string | null; // custom avatar image URL, null = use the emoji
}

/** Names are shown in public embeds, so keep them tame and mention-free. */
export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/[\r\n]/g, ' ').replace(/[@`*_~|<>]/g, '');
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

/**
 * A figurine is a fictional companion: buy one, name it, and marry it if a
 * real partner is not on the cards. One per player.
 */
export class FigurineService {
  constructor(private db: Db) {}

  get(userId: string): Figurine | null {
    const row = this.db.prepare('SELECT * FROM figurines WHERE user_id = ?').get(userId) as
      | {
          user_id: string;
          name: string;
          emoji: string;
          married: number;
          created_at: string;
          avatar: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      userId: row.user_id,
      name: row.name,
      emoji: row.emoji,
      married: row.married === 1,
      createdAt: row.created_at,
      avatar: row.avatar ?? null,
    };
  }

  /** Set (or clear, with null) the figurine's custom avatar URL. */
  setAvatar(userId: string, url: string | null): boolean {
    const result = this.db
      .prepare('UPDATE figurines SET avatar = ? WHERE user_id = ?')
      .run(url, userId);
    return result.changes > 0;
  }

  create(userId: string, name: string, emoji: string): boolean {
    if (this.get(userId)) return false;
    this.db
      .prepare('INSERT INTO figurines (user_id, name, emoji) VALUES (?, ?, ?)')
      .run(userId, name, emoji);
    return true;
  }

  rename(userId: string, name: string): boolean {
    const result = this.db
      .prepare('UPDATE figurines SET name = ? WHERE user_id = ?')
      .run(name, userId);
    return result.changes > 0;
  }

  setEmoji(userId: string, emoji: string): boolean {
    const result = this.db
      .prepare('UPDATE figurines SET emoji = ? WHERE user_id = ?')
      .run(emoji, userId);
    return result.changes > 0;
  }

  setMarried(userId: string, married: boolean): boolean {
    const result = this.db
      .prepare('UPDATE figurines SET married = ? WHERE user_id = ?')
      .run(married ? 1 : 0, userId);
    return result.changes > 0;
  }

  /** The figurine this player is married to, if any. */
  spouse(userId: string): Figurine | null {
    const fig = this.get(userId);
    return fig?.married ? fig : null;
  }

  discard(userId: string): boolean {
    const result = this.db.prepare('DELETE FROM figurines WHERE user_id = ?').run(userId);
    return result.changes > 0;
  }
}
