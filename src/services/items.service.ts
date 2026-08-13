import type { Db } from '../db/database.js';

export interface ShopItem {
  key: string;
  name: string;
  emoji: string;
  price: number; // xu
  desc: string;
}

export const SHOP_ITEMS: Record<string, ShopItem> = {
  khien: {
    key: 'khien',
    name: 'Khiên chống trộm',
    emoji: '🛡️',
    price: 5_000,
    desc: 'Tự động chặn 1 lần bị trộm rồi vỡ',
  },
  nhan: {
    key: 'nhan',
    name: 'Nhẫn cầu hôn',
    emoji: '💍',
    price: 10_000,
    desc: 'Vật phẩm bắt buộc để /cauhon ai đó',
  },
  hopqua: {
    key: 'hopqua',
    name: 'Hộp quà bí ẩn',
    emoji: '📦',
    price: 1_000,
    desc: 'Mở ngay khi mua, nhận ngẫu nhiên 0 đến 3.000 xu',
  },
};

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

  inventory(userId: string): Array<{ item: string; qty: number }> {
    return this.db
      .prepare('SELECT item, qty FROM user_items WHERE user_id = ? AND qty > 0 ORDER BY item')
      .all(userId) as Array<{ item: string; qty: number }>;
  }
}
