import type { Db } from '../db/database.js';

export interface ShopItem {
  key: string;
  name: string;
  emoji: string;
  price: number; // xu
  desc: string;
  usable?: boolean; // consumed on demand from the /tuido panel
}

/** Everything in the shop stays at or under 1.000 xu. */
export const SHOP_ITEMS: Record<string, ShopItem> = {
  khien: {
    key: 'khien',
    name: 'Khiên chống trộm',
    emoji: '🛡️',
    price: 800,
    desc: 'Tự động chặn 1 lần bị trộm rồi vỡ',
  },
  mubaohiem: {
    key: 'mubaohiem',
    name: 'Mũ bảo hiểm',
    emoji: '🪖',
    price: 1_000,
    desc: 'Trúng đạn cò quay Nga vẫn không phải nhập viện, mũ vỡ sau 1 lần',
  },
  nhan: {
    key: 'nhan',
    name: 'Nhẫn cầu hôn',
    emoji: '💍',
    price: 1_000,
    desc: 'Vật phẩm bắt buộc để /cuoi ai đó',
  },
  hopqua: {
    key: 'hopqua',
    name: 'Hộp quà bí ẩn',
    emoji: '📦',
    price: 500,
    desc: 'Mở ngay khi mua, nhận ngẫu nhiên 0 đến 900 xu',
  },
  buamayman: {
    key: 'buamayman',
    name: 'Bùa may mắn',
    emoji: '🍀',
    price: 1_000,
    desc: 'Dùng để bật buff: thắng ván nào cũng +10% tiền lời trong 1 giờ',
    usable: true,
  },
  caphe: {
    key: 'caphe',
    name: 'Ly cà phê',
    emoji: '☕',
    price: 300,
    desc: 'Dùng để xóa ngay cooldown /lamviec, cày tiếp không cần chờ',
    usable: true,
  },
  chiakhoa: {
    key: 'chiakhoa',
    name: 'Chìa khóa vạn năng',
    emoji: '🗝️',
    price: 200,
    desc: 'Dùng để thoát tù hoặc trốn viện ngay, khỏi tốn tiền chuộc',
    usable: true,
  },
  hinhnom: {
    key: 'hinhnom',
    name: 'Hình nộm',
    emoji: '🎎',
    price: 1_000,
    desc: 'Người bạn tưởng tượng: tự đặt tên, chọn hình, cưới luôn cũng được (/hinhnom)',
  },
  theten: {
    key: 'theten',
    name: 'Thẻ đổi tên',
    emoji: '🏷️',
    price: 200,
    desc: 'Đổi tên hoặc đổi hình cho hình nộm của bạn',
  },
};

export const USABLE_ITEMS = Object.values(SHOP_ITEMS).filter((i) => i.usable);

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Loose lookup for typed commands: `!mua bua`, `!mua buamayman` and
 * `!mua bùa may mắn` all land on the same item. An ambiguous prefix resolves
 * to nothing rather than guessing, so nobody buys the wrong thing.
 */
export function findShopItem(raw: string, pool: ShopItem[] = Object.values(SHOP_ITEMS)): ShopItem | null {
  const needle = normalize(raw);
  if (!needle) return null;
  const exact = pool.find((i) => i.key === needle || normalize(i.name) === needle);
  if (exact) return exact;
  const partial = pool.filter((i) => i.key.startsWith(needle) || normalize(i.name).includes(needle));
  return partial.length === 1 ? partial[0] : null;
}

export class ItemsService {
  constructor(private db: Db) {}

  add(userId: string, item: string, qty = 1): void {
    this.db
      .prepare(
        `INSERT INTO user_items (user_id, item, qty) VALUES (?, ?, ?)
         ON CONFLICT(user_id, item) DO UPDATE SET qty = qty + excluded.qty`,
      )
      .run(userId, item, qty);
  }

  /** Consume one; false when the user has none. */
  consume(userId: string, item: string): boolean {
    const result = this.db
      .prepare('UPDATE user_items SET qty = qty - 1 WHERE user_id = ? AND item = ? AND qty > 0')
      .run(userId, item);
    return result.changes > 0;
  }

  count(userId: string, item: string): number {
    const row = this.db
      .prepare('SELECT qty FROM user_items WHERE user_id = ? AND item = ?')
      .get(userId, item) as { qty: number } | undefined;
    return row?.qty ?? 0;
  }

  /** Hand items to another player; false when the giver is short. */
  transfer(fromId: string, toId: string, item: string, qty: number): boolean {
    if (!Number.isInteger(qty) || qty <= 0) return false;
    const run = this.db.transaction(() => {
      const taken = this.db
        .prepare('UPDATE user_items SET qty = qty - ? WHERE user_id = ? AND item = ? AND qty >= ?')
        .run(qty, fromId, item, qty);
      if (taken.changes === 0) throw new Error('insufficient');
      this.add(toId, item, qty);
    });
    try {
      run();
      return true;
    } catch {
      return false;
    }
  }

  inventory(userId: string): Array<{ item: string; qty: number }> {
    return this.db
      .prepare('SELECT item, qty FROM user_items WHERE user_id = ? AND qty > 0 ORDER BY item')
      .all(userId) as Array<{ item: string; qty: number }>;
  }
}
