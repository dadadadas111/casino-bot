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

/**
 * Below the confident thresholds sits a band where the call is genuinely
 * unclear. Discarding those wastes questions we already paid for, so they go
 * to a review queue instead of the bin.
 */
export const BORDERLINE_SAME_ANSWER = 0.2;
export const BORDERLINE_SIMILARITY = 0.6;

export type Verdict = 'duplicate' | 'borderline' | 'distinct';

export function classify(a: Fingerprint, b: Fingerprint): Verdict {
  const score = jaccard(a.tokens, b.tokens);
  const sameAnswer = a.answer.length > 0 && a.answer === b.answer;

  if (sameAnswer && score >= SAME_ANSWER_THRESHOLD) return 'duplicate';
  if (score >= SIMILARITY_THRESHOLD) return 'duplicate';
  if (sameAnswer && score >= BORDERLINE_SAME_ANSWER) return 'borderline';
  if (score >= BORDERLINE_SIMILARITY) return 'borderline';
  return 'distinct';
}

/** True when the two questions are effectively asking the same thing. */
export function isNearDuplicate(a: Fingerprint, b: Fingerprint): boolean {
  return classify(a, b) === 'duplicate';
}

/**
 * Filter candidates against what already exists and against each other, so a
 * single batch cannot smuggle in its own internal repeats.
 */
export interface TriageResult<T> {
  kept: T[];
  dropped: Array<{ candidate: T; matched: string }>;
  borderline: Array<{ candidate: T; matched: string; score: number }>;
}

export function rejectDuplicates<T extends ComparableQuestion>(
  candidates: T[],
  existing: ComparableQuestion[],
): TriageResult<T> {
  const known = existing.map((q) => ({ print: fingerprint(q), text: q.question }));
  const kept: T[] = [];
  const dropped: Array<{ candidate: T; matched: string }> = [];
  const borderline: Array<{ candidate: T; matched: string; score: number }> = [];

  for (const candidate of candidates) {
    const print = fingerprint(candidate);
    let verdictMatch: { text: string; verdict: Verdict; score: number } | null = null;
    for (const k of known) {
      const verdict = classify(print, k.print);
      if (verdict === 'distinct') continue;
      const score = jaccard(print.tokens, k.print.tokens);
      // A confident duplicate settles it; keep looking only while unsure.
      if (verdict === 'duplicate') {
        verdictMatch = { text: k.text, verdict, score };
        break;
      }
      if (!verdictMatch) verdictMatch = { text: k.text, verdict, score };
    }

    if (verdictMatch?.verdict === 'duplicate') {
      dropped.push({ candidate, matched: verdictMatch.text });
      continue;
    }
    if (verdictMatch?.verdict === 'borderline') {
      borderline.push({ candidate, matched: verdictMatch.text, score: verdictMatch.score });
      continue;
    }
    kept.push(candidate);
    known.push({ print, text: candidate.question });
  }
  return { kept, dropped, borderline };
}
