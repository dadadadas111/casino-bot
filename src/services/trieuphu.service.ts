import { QUESTIONS, type QuizQuestion, type QuizTier } from '../data/trieuphu-questions.js';

/** Prize per question (index 0 = question 1). */
export const LADDER = [
  100, 200, 300, 400, 500, 800, 1_200, 1_600, 2_000, 2_500, 4_000, 6_000, 8_000, 10_000, 15_000,
] as const;

export const QUESTION_COUNT = LADDER.length;

export interface GameQuestion {
  question: string;
  answers: string[];
  correct: number; // index into the shuffled answers
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleTier(tier: QuizTier, count: number): QuizQuestion[] {
  return shuffled(QUESTIONS.filter((q) => q.tier === tier)).slice(0, count);
}

/** Shuffle each question's answer order while tracking the correct index. */
export function toGameQuestions(
  raw: Array<{ question: string; answers: string[]; correct: number }>,
): GameQuestion[] {
  return raw.map((q) => {
    const order = shuffled([0, 1, 2, 3]);
    return {
      question: q.question,
      answers: order.map((i) => q.answers[i]),
      correct: order.indexOf(q.correct),
    };
  });
}

/** 15 bank questions: 5 easy, 5 medium, 5 hard, answer order shuffled. */
export function buildGameQuestions(): GameQuestion[] {
  return toGameQuestions([
    ...sampleTier('easy', 5),
    ...sampleTier('medium', 5),
    ...sampleTier('hard', 5),
  ]);
}

/** Prize when stopping voluntarily (or timing out) after `correct` right answers. */
export function stopPrize(correct: number): number {
  return correct === 0 ? 0 : LADDER[correct - 1];
}

/** Prize when answering wrong: fall back to the last safety milestone (Q5/Q10). */
export function wrongPrize(correct: number): number {
  if (correct >= 10) return LADDER[9];
  if (correct >= 5) return LADDER[4];
  return 0;
}

/** The milestone amount currently locked in, for display. */
export function safeAmount(correct: number): number {
  return wrongPrize(correct);
}
