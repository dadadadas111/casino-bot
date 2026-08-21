/**
 * The mission catalogue. A mission is a small, quick goal that nudges players
 * to try a game they skip or to interact with someone. Pure data + matching
 * logic, no DB. Rewards stay small (below a work shift) so missions add variety
 * rather than a grind faucet.
 */

export type MissionEvent =
  | 'play'
  | `play:${string}`
  | 'win'
  | `win:${string}`
  | 'bigwin'
  | 'work'
  | 'daily'
  | 'buy'
  | 'bank'
  | 'interact'
  | 'gift'
  | 'transfer'
  | 'rob'
  | 'quiz';

export interface Mission {
  id: string;
  event: MissionEvent;
  target: number;
  reward: number;
  icon: string;
  text: string;
}

export const MISSIONS: Mission[] = [
  { id: 'play3', event: 'play', target: 3, reward: 800, icon: '🎲', text: 'Chơi 3 ván bất kỳ' },
  { id: 'win2', event: 'win', target: 2, reward: 1_200, icon: '🎉', text: 'Thắng 2 ván bất kỳ' },
  { id: 'bigwin', event: 'bigwin', target: 1, reward: 2_000, icon: '💥', text: 'Ăn một ván gấp đôi tiền cược trở lên' },
  { id: 'win_bj', event: 'win:blackjack', target: 1, reward: 1_500, icon: '🃏', text: 'Thắng một ván Blackjack' },
  { id: 'win_tx', event: 'win:taixiu', target: 1, reward: 1_200, icon: '🎲', text: 'Thắng một ván Tài xỉu' },
  { id: 'win_bc', event: 'win:baucua', target: 1, reward: 1_200, icon: '🦀', text: 'Thắng một ván Bầu cua' },
  { id: 'play_hilo', event: 'play:hilo', target: 2, reward: 1_000, icon: '🎴', text: 'Chơi 2 ván Cao hay Thấp' },
  { id: 'play_domin', event: 'play:domin', target: 1, reward: 900, icon: '💣', text: 'Chơi một ván Dò mìn' },
  { id: 'play_slots', event: 'play:slots', target: 3, reward: 900, icon: '🎰', text: 'Quay máy xèng 3 lần' },
  { id: 'work2', event: 'work', target: 2, reward: 1_000, icon: '🔨', text: 'Đi làm 2 ca' },
  { id: 'daily', event: 'daily', target: 1, reward: 600, icon: '📅', text: 'Điểm danh hôm nay' },
  { id: 'quiz', event: 'quiz', target: 1, reward: 1_200, icon: '💰', text: 'Chơi một ván Ai Là Triệu Phú' },
  { id: 'buy', event: 'buy', target: 1, reward: 800, icon: '🛒', text: 'Mua một món trong cửa hàng' },
  { id: 'bank', event: 'bank', target: 1, reward: 700, icon: '🏦', text: 'Gửi xu vào két' },
  { id: 'interact', event: 'interact', target: 1, reward: 900, icon: '🤗', text: 'Tương tác với một người (ôm, đấm, chọc...)' },
  { id: 'gift', event: 'gift', target: 1, reward: 1_300, icon: '🎁', text: 'Tặng quà cho ai đó' },
  { id: 'transfer', event: 'transfer', target: 1, reward: 800, icon: '💸', text: 'Chuyển xu cho một người khác' },
  { id: 'rob', event: 'rob', target: 1, reward: 1_800, icon: '🦹', text: 'Trộm thành công một lần' },
];

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function missionById(id: string): Mission | undefined {
  return BY_ID.get(id);
}

/** A random mission, never the one just finished, so it always feels fresh. */
export function pickMission(exclude: string | null, rng: () => number = Math.random): Mission {
  const pool = exclude ? MISSIONS.filter((m) => m.id !== exclude) : MISSIONS;
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * The events one finished game emits, so a single hook can drive many game
 * missions. Real bets only: a free game (bet 0) is not counted here.
 */
export function gameEvents(bet: number, payout: number, game: string): MissionEvent[] {
  if (bet <= 0) return [];
  const events: MissionEvent[] = ['play', `play:${game}`];
  if (payout > bet) {
    events.push('win', `win:${game}`);
    if (payout >= bet * 2) events.push('bigwin');
  }
  return events;
}
