/**
 * The fixed set of gameplay effects an item can carry. Both global common
 * items and per-server custom items reference these by kind, so the effect
 * logic lives in one place and fires no matter where the item came from.
 *
 * `serverAllowed` gates which effects a server admin may put on a custom item.
 * Effects that mint xu (mystery_box) or are special (marriage_ring) stay
 * owner-only, so a server admin cannot print money on the shared wallet.
 * `passive` effects fire on a game event (being robbed, roulette); the rest
 * are used on demand from the bag. `floor` is the default minimum price a
 * server item with this effect may be sold for (tunable via config), which
 * stops a server from undercutting the global economy.
 */
export type EffectKind =
  | 'block_theft'
  | 'survive_roulette'
  | 'clear_work_cd'
  | 'escape_lockup'
  | 'luck_buff'
  | 'decoy'
  | 'marriage_ring'
  | 'mystery_box'
  | 'grant_role';

export interface EffectDef {
  kind: EffectKind;
  label: string;
  passive: boolean;
  serverAllowed: boolean;
  floor: number;
}

// v1: only the three "use on demand" effects are open to server items, since
// they all dispatch through the single /tuido use handler. Passive effects
// (block_theft, survive_roulette, decoy) fire at scattered game sites and stay
// owner-only for now; they can be opened to servers once those sites route by
// effect kind. mystery_box (mints xu) and marriage_ring stay owner-only always.
export const EFFECTS: Record<EffectKind, EffectDef> = {
  block_theft: { kind: 'block_theft', label: 'Chặn 1 lần bị trộm', passive: true, serverAllowed: false, floor: 500 },
  survive_roulette: { kind: 'survive_roulette', label: 'Sống sót cò quay Nga', passive: true, serverAllowed: false, floor: 800 },
  clear_work_cd: { kind: 'clear_work_cd', label: 'Xóa cooldown làm việc', passive: false, serverAllowed: true, floor: 300 },
  escape_lockup: { kind: 'escape_lockup', label: 'Thoát tù hoặc viện ngay', passive: false, serverAllowed: true, floor: 200 },
  luck_buff: { kind: 'luck_buff', label: 'Buff may mắn +10% trong 1 giờ', passive: false, serverAllowed: true, floor: 1000 },
  decoy: { kind: 'decoy', label: 'Hình nộm đánh lạc hướng', passive: true, serverAllowed: false, floor: 1000 },
  marriage_ring: { kind: 'marriage_ring', label: 'Nhẫn cầu hôn (để /cuoi)', passive: false, serverAllowed: false, floor: 1000 },
  mystery_box: { kind: 'mystery_box', label: 'Hộp quà bí ẩn (sinh xu)', passive: false, serverAllowed: false, floor: 500 },
  // Owning grants a Discord role. Not consumed, no economy impact, so no floor.
  grant_role: { kind: 'grant_role', label: 'Nhận role Discord', passive: false, serverAllowed: true, floor: 0 },
};

/**
 * Consumable gameplay effects a server admin can put on an item, each with a
 * floor price. grant_role is server-allowed too but handled separately (it is
 * not consumed and has no floor), so it is excluded here.
 */
export const SERVER_EFFECTS: EffectDef[] = Object.values(EFFECTS).filter(
  (e) => e.serverAllowed && e.floor > 0,
);

export function isEffectKind(x: string | null | undefined): x is EffectKind {
  return !!x && Object.prototype.hasOwnProperty.call(EFFECTS, x);
}

export function effectLabel(kind: string | null | undefined): string {
  return isEffectKind(kind) ? EFFECTS[kind].label : 'Không có (sưu tầm)';
}
