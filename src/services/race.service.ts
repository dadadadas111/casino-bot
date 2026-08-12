export interface Horse {
  name: string;
  weight: number; // win probability
  odds: number; // payout multiplier (≈ 0.9 / weight → house edge 10%)
}

export const HORSE_COUNT = 4;
export const TRACK_LEN = 16;
export const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

const NAMES = [
  'Tia Chớp',
  'Gió Bắc',
  'Bão Táp',
  'Mây Hồng',
  'Sấm Sét',
  'Hỏa Long',
  'Tuyết Trắng',
  'Ánh Trăng',
  'Vó Thép',
  'Phi Vân',
  'Hắc Mã',
  'Kim Cương',
];

const WEIGHTS = [0.4, 0.3, 0.18, 0.12];

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 4 random-named horses with shuffled win probabilities and matching odds. */
export function generateHorses(): Horse[] {
  const names = shuffled(NAMES).slice(0, HORSE_COUNT);
  const weights = shuffled(WEIGHTS);
  return names.map((name, i) => ({
    name,
    weight: weights[i],
    odds: Math.round((0.9 / weights[i]) * 10) / 10,
  }));
}

/** Weighted random winner, honoring each horse's stated probability. */
export function pickWinner(horses: Horse[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < horses.length; i++) {
    acc += horses[i].weight;
    if (r < acc) return i;
  }
  return horses.length - 1;
}

export function renderTrack(
  positions: number[],
  horses: Horse[],
  winnerIdx: number | null,
): string {
  return positions
    .map((pos, i) => {
      const clamped = Math.min(pos, TRACK_LEN);
      const lane = '·'.repeat(clamped) + '🏇' + '·'.repeat(TRACK_LEN - clamped);
      const crown = winnerIdx === i ? ' 👑' : '';
      return `${NUM_EMOJI[i]} ${lane}🏁 **${horses[i].name}** (x${horses[i].odds})${crown}`;
    })
    .join('\n');
}
