/**
 * "Did you mean" for typed commands. Discord can only autocomplete slash
 * commands, never message text, so the next best thing is catching the typo
 * after the fact. Pure logic, no Discord types.
 */

/** Levenshtein distance, bounded so a far-off word bails out early. */
export function editDistance(a: string, b: string, limit = 3): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * The closest known command, or null when nothing is near enough. Staying
 * strict matters: this bot shares `!` with other apps, so a stray word must
 * never draw a reply.
 */
export function closestCommand(input: string, known: Iterable<string>): string | null {
  const needle = input.toLowerCase();
  if (needle.length < 2) return null;

  let best: string | null = null;
  let bestScore = Infinity;
  let tied = false;
  for (const candidate of known) {
    if (candidate === needle) return null; // already valid, nothing to suggest
    // A typo of a short word may only be one edit out; longer words get two.
    const limit = candidate.length <= 4 ? 1 : 2;
    const distance = editDistance(needle, candidate, limit);
    if (distance > limit) continue;
    if (distance < bestScore) {
      best = candidate;
      bestScore = distance;
      tied = false;
    } else if (distance === bestScore) {
      tied = true;
    }
  }
  // Two equally good guesses is no guess at all; better silent than wrong.
  return tied ? null : best;
}
