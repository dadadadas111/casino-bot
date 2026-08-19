import type { Db } from '../db/database.js';

export type AssetKind = 'nha' | 'xe' | 'thucung';

export interface AssetDef {
  key: string;
  kind: AssetKind;
  name: string;
  emoji: string;
  price: number;
  desc: string;
  /** Ladder position within a kind; a higher tier replaces a lower one. */
  tier: number;
}

/**
 * Big-ticket goods. Prices are deliberately far above the 1.000 xu shop so
 * they give hoarded coins somewhere to go and give players a long-term goal.
 */
export const ASSETS: Record<string, AssetDef> = {
  nhatro: {
    key: 'nhatro', kind: 'nha', name: 'Nhà trọ', emoji: '🏚️', price: 20_000, tier: 1,
    desc: 'Điểm danh +10%',
  },
  nhapho: {
    key: 'nhapho', kind: 'nha', name: 'Nhà phố', emoji: '🏠', price: 100_000, tier: 2,
    desc: 'Điểm danh +25%',
  },
  bietthu: {
    key: 'bietthu', kind: 'nha', name: 'Biệt thự', emoji: '🏡', price: 400_000, tier: 3,
    desc: 'Điểm danh +50%',
  },
  laudai: {
    key: 'laudai', kind: 'nha', name: 'Lâu đài', emoji: '🏰', price: 1_500_000, tier: 4,
    desc: 'Điểm danh +100%',
  },
  xemay: {
    key: 'xemay', kind: 'xe', name: 'Xe máy', emoji: '🛵', price: 30_000, tier: 1,
    desc: 'Làm việc mỗi 8 phút thay vì 10',
  },
  oto: {
    key: 'oto', kind: 'xe', name: 'Ô tô', emoji: '🚗', price: 150_000, tier: 2,
    desc: 'Làm việc mỗi 6 phút',
  },
  sieuxe: {
    key: 'sieuxe', kind: 'xe', name: 'Siêu xe', emoji: '🏎️', price: 600_000, tier: 3,
    desc: 'Làm việc mỗi 4 phút',
  },
  cho: {
    key: 'cho', kind: 'thucung', name: 'Chó giữ nhà', emoji: '🐶', price: 25_000, tier: 1,
    desc: '20% cơ hội đuổi được trộm, không vỡ như khiên',
  },
  meo: {
    key: 'meo', kind: 'thucung', name: 'Mèo', emoji: '🐱', price: 25_000, tier: 1,
    desc: 'Mỗi ngày tha về 100-500 xu, nhận cùng lúc điểm danh',
  },
  vet: {
    key: 'vet', kind: 'thucung', name: 'Vẹt', emoji: '🦜', price: 80_000, tier: 2,
    desc: 'Mách nước 50/50 một lần mỗi ván Ai Là Triệu Phú',
  },
};

export const ASSET_LIST = Object.values(ASSETS);

export const KIND_LABEL: Record<AssetKind, { name: string; emoji: string }> = {
  nha: { name: 'Nhà cửa', emoji: '🏠' },
  xe: { name: 'Xe cộ', emoji: '🚗' },
  thucung: { name: 'Thú cưng', emoji: '🐾' },
};

// Effects, kept as plain lookups so the callers stay readable.
export const DAILY_BONUS: Record<string, number> = {
  nhatro: 0.1, nhapho: 0.25, bietthu: 0.5, laudai: 1,
};
export const WORK_COOLDOWN_MS: Record<string, number> = {
  xemay: 8 * 60_000, oto: 6 * 60_000, sieuxe: 4 * 60_000,
};
export const DOG_BLOCK_CHANCE = 0.2;
export const CAT_MIN = 100;
export const CAT_MAX = 500;
/** What a seized asset fetches at auction. */
export const SEIZE_RATE = 0.5;

export type BuyCheck =
  | { ok: true; tradeIn: AssetDef | null; cost: number }
  | { ok: false; reason: 'owned' | 'downgrade' };

/**
 * One item per category. Moving up the ladder trades the old one in at half
 * price; moving down is refused outright so nobody downgrades by accident.
 * Pure so the rule can be tested without a database.
 */
export function canBuy(owned: AssetDef[], target: AssetDef): BuyCheck {
  const current = owned.find((a) => a.kind === target.kind) ?? null;
  if (current?.key === target.key) return { ok: false, reason: 'owned' };
  if (current && current.tier > target.tier) return { ok: false, reason: 'downgrade' };
  const tradeInValue = current ? Math.floor(current.price * SEIZE_RATE) : 0;
  return { ok: true, tradeIn: current, cost: Math.max(0, target.price - tradeInValue) };
}

export class AssetsService {
  constructor(private db: Db) {}

  owned(userId: string): AssetDef[] {
    const rows = this.db
      .prepare('SELECT asset FROM user_assets WHERE user_id = ?')
      .all(userId) as Array<{ asset: string }>;
    return rows
      .map((r) => ASSETS[r.asset])
      .filter((a): a is AssetDef => Boolean(a))
      .sort((a, b) => a.price - b.price);
  }

  has(userId: string, key: string): boolean {
    return Boolean(
      this.db
        .prepare('SELECT 1 FROM user_assets WHERE user_id = ? AND asset = ?')
        .get(userId, key),
    );
  }

  /** The best asset the player holds in a category, or null. */
  best(userId: string, kind: AssetKind): AssetDef | null {
    return this.owned(userId)
      .filter((a) => a.kind === kind)
      .reduce<AssetDef | null>((top, a) => (!top || a.tier > top.tier ? a : top), null);
  }

  add(userId: string, key: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO user_assets (user_id, asset) VALUES (?, ?)')
      .run(userId, key);
  }

  remove(userId: string, key: string): boolean {
    return (
      this.db.prepare('DELETE FROM user_assets WHERE user_id = ? AND asset = ?').run(userId, key)
        .changes > 0
    );
  }

  /** Total sticker price of everything owned; the basis for a credit limit. */
  netWorth(userId: string): number {
    return this.owned(userId).reduce((sum, a) => sum + a.price, 0);
  }

  dailyMultiplier(userId: string): number {
    const house = this.best(userId, 'nha');
    return 1 + (house ? (DAILY_BONUS[house.key] ?? 0) : 0);
  }

  workCooldownMs(userId: string, fallback: number): number {
    const vehicle = this.best(userId, 'xe');
    return vehicle ? (WORK_COOLDOWN_MS[vehicle.key] ?? fallback) : fallback;
  }
}
