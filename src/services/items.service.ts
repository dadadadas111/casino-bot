import type { Db } from '../db/database.js';

export interface ShopItem {
  key: string;
  name: string;
  emoji: string;
  price: number; // xu
  desc: string;
  usable?: boolean; // consumed on demand via /dungdo
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
  buamayman: {
    key: 'buamayman',
    name: 'Bùa may mắn',
    emoji: '🍀',
    price: 8_000,
    desc: 'Dùng để bật buff: thắng ván nào cũng +10% tiền lời trong 1 giờ',
    usable: true,
  },
  caphe: {
    key: 'caphe',
    name: 'Ly cà phê',
    emoji: '☕',
    price: 2_000,
    desc: 'Dùng để xóa ngay cooldown /lamviec, cày tiếp không cần chờ',
    usable: true,
  },
  chiakhoa: {
    key: 'chiakhoa',
    name: 'Chìa khóa vạn năng',
    emoji: '🗝️',
    price: 6_000,
    desc: 'Dùng để tự phá khóa ra tù ngay, không tốn tiền nộp phạt',
    usable: true,
  },
};

export const USABLE_ITEMS = Object.values(SHOP_ITEMS).filter((i) => i.usable);

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
