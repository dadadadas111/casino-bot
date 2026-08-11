import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/data/trieuphu-questions';
import {
  LADDER,
  QUESTION_COUNT,
  buildGameQuestions,
  stopPrize,
  wrongPrize,
} from '../src/services/trieuphu.service';

describe('question bank', () => {
  it('has at least 20 questions per tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(QUESTIONS.filter((q) => q.tier === tier).length).toBeGreaterThanOrEqual(20);
    }
  });

  it('every question has 4 unique answers and a valid correct index', () => {
    for (const q of QUESTIONS) {
      expect(q.answers).toHaveLength(4);
      expect(new Set(q.answers).size).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
    }
  });

  it('has no duplicate question texts', () => {
    const texts = QUESTIONS.map((q) => q.question);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('buildGameQuestions', () => {
  it('produces 15 unique questions in easy -> medium -> hard order', () => {
    const game = buildGameQuestions();
    expect(game).toHaveLength(QUESTION_COUNT);
    expect(new Set(game.map((q) => q.question)).size).toBe(QUESTION_COUNT);

    const tierOf = (text: string) => QUESTIONS.find((q) => q.question === text)!.tier;
    expect(game.slice(0, 5).every((q) => tierOf(q.question) === 'easy')).toBe(true);
    expect(game.slice(5, 10).every((q) => tierOf(q.question) === 'medium')).toBe(true);
    expect(game.slice(10).every((q) => tierOf(q.question) === 'hard')).toBe(true);
  });

  it('keeps the correct answer intact after shuffling options', () => {
    for (const gq of buildGameQuestions()) {
      const original = QUESTIONS.find((q) => q.question === gq.question)!;
      expect(gq.answers[gq.correct]).toBe(original.answers[original.correct]);
      expect([...gq.answers].sort()).toEqual([...original.answers].sort());
    }
  });
});

describe('prizes', () => {
  it('stop keeps the ladder value of the last correct answer', () => {
    expect(stopPrize(0)).toBe(0);
    expect(stopPrize(1)).toBe(100);
    expect(stopPrize(9)).toBe(2_000);
    expect(stopPrize(15)).toBe(15_000);
  });

  it('wrong answers fall back to the milestones', () => {
    expect(wrongPrize(0)).toBe(0);
    expect(wrongPrize(4)).toBe(0);
    expect(wrongPrize(5)).toBe(500);
    expect(wrongPrize(9)).toBe(500);
    expect(wrongPrize(10)).toBe(2_500);
    expect(wrongPrize(14)).toBe(2_500);
  });

  it('ladder tops out at 15.000', () => {
    expect(LADDER).toHaveLength(15);
    expect(LADDER[14]).toBe(15_000);
  });
});
