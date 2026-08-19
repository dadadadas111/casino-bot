/**
 * Career ladder for /lamviec. Pure logic: a rank is a function of how many
 * shifts the player has clocked, nothing else.
 */

export interface JobRank {
  key: string;
  name: string;
  emoji: string;
  /** Shifts needed to hold this rank. */
  from: number;
  min: number;
  max: number;
}

export const JOB_RANKS: JobRank[] = [
  { key: 'chayvat', name: 'Chạy vặt', emoji: '🧹', from: 0, min: 200, max: 500 },
  { key: 'phuho', name: 'Phụ hồ', emoji: '🔨', from: 10, min: 350, max: 700 },
  { key: 'nhanvien', name: 'Nhân viên', emoji: '👔', from: 30, min: 500, max: 1_000 },
  { key: 'truongphong', name: 'Trưởng phòng', emoji: '📊', from: 80, min: 800, max: 1_500 },
  { key: 'giamdoc', name: 'Giám đốc', emoji: '💼', from: 200, min: 1_200, max: 2_200 },
  { key: 'chutich', name: 'Chủ tịch', emoji: '🏦', from: 500, min: 2_000, max: 3_500 },
];

/** How much a rank adds to the loan ceiling: a steady job is collateral. */
export const JOB_CREDIT: Record<string, number> = {
  chayvat: 0,
  phuho: 5_000,
  nhanvien: 15_000,
  truongphong: 35_000,
  giamdoc: 70_000,
  chutich: 100_000,
};

export function rankFor(shifts: number): JobRank {
  let current = JOB_RANKS[0];
  for (const rank of JOB_RANKS) {
    if (shifts >= rank.from) current = rank;
  }
  return current;
}

/** The rank above the current one, or null at the top of the ladder. */
export function nextRank(shifts: number): JobRank | null {
  return JOB_RANKS.find((r) => r.from > shifts) ?? null;
}

/** True when this shift is the one that earns a promotion. */
export function isPromotion(shiftsBefore: number): boolean {
  return rankFor(shiftsBefore).key !== rankFor(shiftsBefore + 1).key;
}

export function shiftsToNext(shifts: number): number {
  const next = nextRank(shifts);
  return next ? next.from - shifts : 0;
}
