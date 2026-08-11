export const COLORS = {
  win: 0x57f287,
  lose: 0xed4245,
  push: 0x99aab5,
  playing: 0x5865f2,
  gold: 0xf1c40f,
  info: 0x3498db,
} as const;

export const COIN = '🪙';

/** Vietnamese-style thousands separator: 1.234.567 */
export function formatCoins(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ${COIN}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
