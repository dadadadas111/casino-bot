import { describe, expect, it } from 'vitest';
import { questionKey } from '../src/services/mongo.service';
import { buildBatchPrompt, parseTieredQuestions } from '../src/services/quiz-ai.service';
import { CacheService } from '../src/services/redis.service';
import { PER_GAME, REFILL_BATCH, REFILL_GAMES_LEFT } from '../src/services/quiz-pool.service';

describe('questionKey (chống trùng lặp)', () => {
  it('treats punctuation, case and spacing differences as the same question', () => {
    expect(questionKey('Thủ đô của Việt Nam là gì?')).toBe(
      questionKey('  thủ đô của việt nam là GÌ ??? '),
    );
  });

  it('keeps genuinely different questions apart', () => {
    expect(questionKey('Thủ đô của Việt Nam?')).not.toBe(questionKey('Thủ đô của Lào?'));
  });
});

describe('parseTieredQuestions', () => {
  const good = (i: number, tier: string) => ({
    question: `Câu hỏi số ${i} nói về điều gì?`,
    answers: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
    correct: 0,
    tier,
  });

  it('keeps the declared difficulty', () => {
    const out = parseTieredQuestions({ questions: [good(1, 'easy'), good(2, 'hard')] });
    expect(out.map((q) => q.tier)).toEqual(['easy', 'hard']);
  });

  it('defaults an unknown difficulty to medium instead of dropping the question', () => {
    const out = parseTieredQuestions({ questions: [good(3, 'impossible')] });
    expect(out).toHaveLength(1);
    expect(out[0].tier).toBe('medium');
  });

  it('still rejects structurally broken questions', () => {
    const out = parseTieredQuestions({
      questions: [{ question: 'ngắn', answers: ['a'], correct: 9, tier: 'easy' }],
    });
    expect(out).toEqual([]);
  });
});

describe('buildBatchPrompt', () => {
  it('asks for a balanced spread by default', () => {
    const prompt = buildBatchPrompt(60, []);
    expect(prompt).toContain('Chia đều độ khó');
    expect(prompt).toContain('60 câu hỏi');
  });

  it('asks for a single difficulty when a refill targets one', () => {
    const prompt = buildBatchPrompt(50, [], 'easy');
    expect(prompt).toContain('TOÀN BỘ 50 câu phải ở mức "easy"');
    expect(prompt).not.toContain('Chia đều độ khó');
  });

  it('lists existing questions to steer away from repeats', () => {
    expect(buildBatchPrompt(10, ['Thủ đô Việt Nam?'])).toContain('Thủ đô Việt Nam?');
  });
});

describe('CacheService without a connection', () => {
  it('behaves like a permanent miss instead of throwing', async () => {
    const cache = new CacheService();
    await cache.connect(undefined);
    expect(await cache.get('bat-ky')).toBeNull();
    await cache.set('bat-ky', { a: 1 }, 60);
    expect(await cache.get('bat-ky')).toBeNull();
    await cache.del('bat-ky');
    expect(await cache.remember('k', 60, () => 'tinh-tuoi')).toBe('tinh-tuoi');
    // No cache means a single process, so the lock must not block the work.
    expect(await cache.acquireLock('lock', 30)).toBe(true);
    await cache.close();
  });
});

describe('pool sizing rules', () => {
  it('draws a full 15-question game', () => {
    expect(Object.values(PER_GAME).reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('refills in batches far larger than one game, which is the whole saving', () => {
    expect(REFILL_BATCH).toBeGreaterThanOrEqual(50);
    expect(REFILL_GAMES_LEFT).toBeGreaterThanOrEqual(1);
  });
});
