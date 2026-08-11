export const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ---- Tài xỉu (sicbo) ----

export interface TaiXiuResult {
  dice: [number, number, number];
  total: number;
  outcome: 'tai' | 'xiu' | 'bao'; // bao = triple, house wins
}

export function rollTaiXiu(): TaiXiuResult {
  const dice: [number, number, number] = [rollDie(), rollDie(), rollDie()];
  const total = dice[0] + dice[1] + dice[2];
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  const outcome = isTriple ? 'bao' : total >= 11 ? 'tai' : 'xiu';
  return { dice, total, outcome };
}

/** 1:1 payout on tai/xiu; triples ("bão") always lose. */
export function taiXiuPayout(result: TaiXiuResult, choice: 'tai' | 'xiu', bet: number): number {
  return result.outcome === choice ? bet * 2 : 0;
}

// ---- Bầu cua ----

export const BAU_CUA_SYMBOLS = {
  bau: { label: 'Bầu', emoji: '🍐' },
  cua: { label: 'Cua', emoji: '🦀' },
  tom: { label: 'Tôm', emoji: '🦐' },
  ca: { label: 'Cá', emoji: '🐟' },
  ga: { label: 'Gà', emoji: '🐓' },
  nai: { label: 'Nai', emoji: '🦌' },
} as const;

export type BauCuaSymbol = keyof typeof BAU_CUA_SYMBOLS;

const BAU_CUA_KEYS = Object.keys(BAU_CUA_SYMBOLS) as BauCuaSymbol[];

export interface BauCuaResult {
  dice: [BauCuaSymbol, BauCuaSymbol, BauCuaSymbol];
  matches: number;
}

export function rollBauCua(choice: BauCuaSymbol): BauCuaResult {
  const dice: [BauCuaSymbol, BauCuaSymbol, BauCuaSymbol] = [
    BAU_CUA_KEYS[rollDie() - 1],
    BAU_CUA_KEYS[rollDie() - 1],
    BAU_CUA_KEYS[rollDie() - 1],
  ];
  const matches = dice.filter((d) => d === choice).length;
  return { dice, matches };
}

/** Classic rules: each matching die pays 1:1, stake returned on any match. */
export function bauCuaPayout(result: BauCuaResult, bet: number): number {
  return result.matches > 0 ? bet * (1 + result.matches) : 0;
}

// ---- Coinflip ----

export interface CoinflipResult {
  side: 'ngua' | 'sap';
}

export function flipCoin(): CoinflipResult {
  return { side: Math.random() < 0.5 ? 'ngua' : 'sap' };
}

export function coinflipPayout(result: CoinflipResult, choice: 'ngua' | 'sap', bet: number): number {
  return result.side === choice ? bet * 2 : 0;
}

// ---- Slots ----

export const SLOT_SYMBOLS = ['🍒', '🍋', '🍇', '🍊', '🔔', '⭐', '💎', '7️⃣'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

/** Multiplier of the bet for three of a kind. Overall RTP ≈ 91%. */
export const SLOT_TRIPLE_PAYOUT: Record<SlotSymbol, number> = {
  '🍒': 15,
  '🍋': 15,
  '🍇': 20,
  '🍊': 20,
  '🔔': 30,
  '⭐': 40,
  '💎': 60,
  '7️⃣': 100,
};

export interface SlotsResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  kind: 'triple' | 'pair' | 'none';
  multiplier: number;
}

export function evaluateSlots(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): SlotsResult {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return { reels, kind: 'triple', multiplier: SLOT_TRIPLE_PAYOUT[a] };
  }
  if (a === b || b === c || a === c) {
    // A pair returns the stake, keeps the game feeling lively.
    return { reels, kind: 'pair', multiplier: 1 };
  }
  return { reels, kind: 'none', multiplier: 0 };
}

export function spinSlots(): SlotsResult {
  const pick = (): SlotSymbol => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  return evaluateSlots([pick(), pick(), pick()]);
}

export function slotsPayout(result: SlotsResult, bet: number): number {
  return bet * result.multiplier;
}
