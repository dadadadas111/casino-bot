/**
 * Forgiving bet parsing for typed (prefix) commands.
 * Accepts: 500, 1.000, 1,000, 1k, 1k5 (=1500), 2m, all/allin/max, half/nua.
 */
export function parseBetToken(token: string, balance: number): number | null {
  const raw = token.toLowerCase().replace(/[.,]/g, '');
  if (['all', 'allin', 'max', 'tattay'].includes(raw)) return Math.max(balance, 0);
  if (['half', 'nua', 'nửa'].includes(raw)) return Math.floor(balance / 2);

  const kHalf = raw.match(/^(\d+)k(\d)$/); // 1k5 = 1500
  if (kHalf) return Number(kHalf[1]) * 1_000 + Number(kHalf[2]) * 100;
  const suffixed = raw.match(/^(\d+)(k|m)$/);
  if (suffixed) return Number(suffixed[1]) * (suffixed[2] === 'k' ? 1_000 : 1_000_000);
  if (/^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Pull a bet amount and a game choice out of args in any order.
 * Choice tokens win over bet tokens on conflict (they never overlap anyway).
 */
export function extractBetAndChoice<T>(
  args: string[],
  choices: Record<string, T>,
  balance: number,
): { bet: number | null; choice: T | null } {
  let bet: number | null = null;
  let choice: T | null = null;
  for (const arg of args) {
    const token = arg.toLowerCase();
    if (token in choices) {
      choice = choices[token];
      continue;
    }
    const parsed = parseBetToken(token, balance);
    if (parsed !== null) bet = parsed;
  }
  return { bet, choice };
}
