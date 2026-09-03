import type { Db } from '../db/database.js';
import type { EffectKind } from './effects.service.js';

/** A custom item a server's admins created. Only offered in that guild. */
export interface GuildItem {
  id: number;
  guildId: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  effect: EffectKind | null;
  rarity: string;
  roleId: string | null;
  usable: boolean;
  enabled: boolean;
  sort: number;
}

export type NewGuildItem = {
  name: string;
  emoji: string;
  price: number;
  description?: string;
  effect?: EffectKind | null;
  rarity?: string;
  roleId?: string | null;
  usable?: boolean;
};

/** Keeps a server's shop small enough to fit a select menu and stay sane. */
export const MAX_GUILD_ITEMS = 25;

interface Row {
  id: number;
  guild_id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  effect: string | null;
  rarity: string;
  role_id: string | null;
  usable: number;
  enabled: number;
  sort: number;
}

function toItem(r: Row): GuildItem {
  return {
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    emoji: r.emoji,
    price: r.price,
    description: r.description,
    effect: (r.effect as EffectKind | null) ?? null,
    rarity: r.rarity,
    roleId: r.role_id,
    usable: !!r.usable,
    enabled: !!r.enabled,
    sort: r.sort,
  };
}

export class GuildItemsService {
  constructor(private db: Db) {}

  /** A server's custom items, cosmetic and effect alike. */
  list(guildId: string, opts: { enabledOnly?: boolean } = {}): GuildItem[] {
    const where = opts.enabledOnly ? 'AND enabled = 1' : '';
    const rows = this.db
      .prepare(`SELECT * FROM guild_items WHERE guild_id = ? ${where} ORDER BY sort, id`)
      .all(guildId) as Row[];
    return rows.map(toItem);
  }

  get(id: number): GuildItem | undefined {
    const row = this.db.prepare('SELECT * FROM guild_items WHERE id = ?').get(id) as Row | undefined;
    return row ? toItem(row) : undefined;
  }

  count(guildId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM guild_items WHERE guild_id = ?')
      .get(guildId) as { n: number };
    return row.n;
  }

  /** Create an item; returns its id. Caller enforces price floor and cap. */
  create(guildId: string, item: NewGuildItem): number {
    const sort = this.count(guildId);
    const result = this.db
      .prepare(
        `INSERT INTO guild_items (guild_id, name, emoji, price, description, effect, rarity, role_id, usable, sort)
         VALUES (@guildId, @name, @emoji, @price, @description, @effect, @rarity, @roleId, @usable, @sort)`,
      )
      .run({
        guildId,
        name: item.name,
        emoji: item.emoji,
        price: item.price,
        description: item.description ?? '',
        effect: item.effect ?? null,
        rarity: item.rarity ?? 'common',
        roleId: item.roleId ?? null,
        usable: item.usable ? 1 : 0,
        sort,
      });
    return Number(result.lastInsertRowid);
  }

  update(id: number, patch: Partial<NewGuildItem> & { enabled?: boolean; sort?: number }): void {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id };
    const set = (col: string, key: string, val: unknown): void => {
      fields.push(`${col} = @${key}`);
      values[key] = val;
    };
    if (patch.name !== undefined) set('name', 'name', patch.name);
    if (patch.emoji !== undefined) set('emoji', 'emoji', patch.emoji);
    if (patch.price !== undefined) set('price', 'price', patch.price);
    if (patch.description !== undefined) set('description', 'description', patch.description);
    if (patch.effect !== undefined) set('effect', 'effect', patch.effect);
    if (patch.rarity !== undefined) set('rarity', 'rarity', patch.rarity);
    if (patch.roleId !== undefined) set('role_id', 'roleId', patch.roleId);
    if (patch.usable !== undefined) set('usable', 'usable', patch.usable ? 1 : 0);
    if (patch.enabled !== undefined) set('enabled', 'enabled', patch.enabled ? 1 : 0);
    if (patch.sort !== undefined) set('sort', 'sort', patch.sort);
    if (!fields.length) return;
    this.db.prepare(`UPDATE guild_items SET ${fields.join(', ')} WHERE id = @id`).run(values);
  }

  /** Delete an item and everyone's ownership of it. */
  remove(id: number): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM guild_user_items WHERE item_id = ?').run(id);
      this.db.prepare('DELETE FROM guild_items WHERE id = ?').run(id);
    });
    tx();
  }

  // --- ownership (scoped to the guild) ---

  ownedQty(guildId: string, userId: string, itemId: number): number {
    const row = this.db
      .prepare('SELECT qty FROM guild_user_items WHERE guild_id = ? AND user_id = ? AND item_id = ?')
      .get(guildId, userId, itemId) as { qty: number } | undefined;
    return row?.qty ?? 0;
  }

  addOwned(guildId: string, userId: string, itemId: number, qty = 1): void {
    this.db
      .prepare(
        `INSERT INTO guild_user_items (guild_id, user_id, item_id, qty) VALUES (?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
      )
      .run(guildId, userId, itemId, qty);
  }

  /** Consume one; false when the user owns none. */
  consumeOwned(guildId: string, userId: string, itemId: number): boolean {
    const result = this.db
      .prepare(
        'UPDATE guild_user_items SET qty = qty - 1 WHERE guild_id = ? AND user_id = ? AND item_id = ? AND qty > 0',
      )
      .run(guildId, userId, itemId);
    return result.changes > 0;
  }

  /** A user's owned custom items in this guild, joined with the catalog. */
  inventory(guildId: string, userId: string): Array<{ item: GuildItem; qty: number }> {
    const rows = this.db
      .prepare(
        `SELECT gi.*, gui.qty AS owned_qty
         FROM guild_user_items gui
         JOIN guild_items gi ON gi.id = gui.item_id
         WHERE gui.guild_id = ? AND gui.user_id = ? AND gui.qty > 0
         ORDER BY gi.sort, gi.id`,
      )
      .all(guildId, userId) as Array<Row & { owned_qty: number }>;
    return rows.map((r) => ({ item: toItem(r), qty: r.owned_qty }));
  }

  /**
   * Top collectors in the guild, ranked by a rarity-weighted score, so owning
   * rare items counts for more than owning many common ones.
   */
  collectors(guildId: string, limit = 10): Array<{ userId: string; distinct: number; score: number }> {
    const rows = this.db
      .prepare(
        `SELECT gui.user_id AS userId,
                COUNT(DISTINCT gui.item_id) AS num,
                SUM(CASE gi.rarity
                      WHEN 'legendary' THEN 15
                      WHEN 'epic' THEN 7
                      WHEN 'rare' THEN 3
                      ELSE 1 END) AS score
         FROM guild_user_items gui
         JOIN guild_items gi ON gi.id = gui.item_id
         WHERE gui.guild_id = ? AND gui.qty > 0
         GROUP BY gui.user_id
         ORDER BY score DESC, num DESC
         LIMIT ?`,
      )
      .all(guildId, limit) as Array<{ userId: string; num: number; score: number }>;
    return rows.map((r) => ({ userId: r.userId, distinct: r.num, score: r.score }));
  }

  /** Everyone in the guild who currently owns this item (for role sync). */
  ownersOf(guildId: string, itemId: number): string[] {
    const rows = this.db
      .prepare(
        'SELECT user_id FROM guild_user_items WHERE guild_id = ? AND item_id = ? AND qty > 0',
      )
      .all(guildId, itemId) as Array<{ user_id: string }>;
    return rows.map((r) => r.user_id);
  }
}
