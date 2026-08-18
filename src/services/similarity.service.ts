/**
 * Near-duplicate detection for quiz questions.
 *
 * The unique index on the normalized text only stops byte-identical repeats,
 * but a model asked twice about the same fact rewords it instead: "Quốc hoa
 * của Việt Nam là loài hoa nào?" against "Loài hoa nào là quốc hoa của Việt
 * Nam?". Comparing content words catches that for free, with no API call.
 */

/** Function words carry no topic signal and would inflate every score. */
const STOPWORDS = new Set([
  'la', 'gi', 'nao', 'cua', 'o', 'va', 'duoc', 'co', 'trong', 'mot', 'cac', 'nhung',
  'ai', 'bao', 'nhieu', 'thuoc', 'tai', 'cho', 'den', 'tu', 'voi', 'hay', 'thi', 'ma',
  'se', 'da', 'nguoi', 'viec', 'dieu', 'khi', 'ra', 'vao', 'len', 'xuong', 'boi',
  'tren', 'duoi', 'sau', 'truoc', 'thuong', 'hien', 'nay', 'the', 'ta', 'ho', 'no',
  'day', 'kia', 'nhu', 'de', 've', 'theo', 'con', 'cung', 'chi', 'ca',
]);

/** Lowercase, strip Vietnamese diacritics and punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Topic-bearing words only. */
export function contentTokens(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Wording alone only settles it when the phrasing is almost verbatim. Short
 * questions share function-adjacent words easily: "Cao nguyên nào cao nhất
 * Việt Nam?" and "Núi nào cao nhất Việt Nam?" overlap two thirds yet ask
 * about different things, so a lower bar here removed real questions.
 */
export const SIMILARITY_THRESHOLD = 0.85;
/**
 * Testing the same fact is the signal that matters, so a shared answer plus
 * moderate overlap is the main rule.
 */
export const SAME_ANSWER_THRESHOLD = 0.35;

export interface ComparableQuestion {
  question: string;
  answers: string[];
  correct: number;
}

export interface Fingerprint {
  tokens: Set<string>;
  answer: string;
}

export function fingerprint(q: ComparableQuestion): Fingerprint {
  return {
    tokens: contentTokens(q.question),
    answer: normalizeText(q.answers[q.correct] ?? ''),
  };
}

/** True when the two questions are effectively asking the same thing. */
export function isNearDuplicate(a: Fingerprint, b: Fingerprint): boolean {
  const score = jaccard(a.tokens, b.tokens);
  if (a.answer.length > 0 && a.answer === b.answer && score >= SAME_ANSWER_THRESHOLD) return true;
  return score >= SIMILARITY_THRESHOLD;
}

/**
 * Filter candidates against what already exists and against each other, so a
 * single batch cannot smuggle in its own internal repeats.
 */
export function rejectDuplicates<T extends ComparableQuestion>(
  candidates: T[],
  existing: ComparableQuestion[],
): { kept: T[]; dropped: Array<{ candidate: T; matched: string }> } {
  const known = existing.map((q) => ({ print: fingerprint(q), text: q.question }));
  const kept: T[] = [];
  const dropped: Array<{ candidate: T; matched: string }> = [];

  for (const candidate of candidates) {
    const print = fingerprint(candidate);
    const clash = known.find((k) => isNearDuplicate(print, k.print));
    if (clash) {
      dropped.push({ candidate, matched: clash.text });
      continue;
    }
    kept.push(candidate);
    known.push({ print, text: candidate.question });
  }
  return { kept, dropped };
}
