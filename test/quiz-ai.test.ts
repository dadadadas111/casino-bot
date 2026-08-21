import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPrompt,
  judgeQuestions,
  generateQuizQuestions,
  parseGeneratedQuestions,
} from '../src/services/quiz-ai.service';

afterEach(() => {
  vi.restoreAllMocks();
});

const goodQuestion = (i: number) => ({
  question: `Câu hỏi số ${i} là câu hỏi gì vậy?`,
  answers: [`Đáp án A${i}`, `Đáp án B${i}`, `Đáp án C${i}`, `Đáp án D${i}`],
  correct: i % 4,
});

const goodPayload = { questions: Array.from({ length: 15 }, (_, i) => goodQuestion(i)) };

function mockCompletion(content: string, status = 200): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }),
  );
}

describe('parseGeneratedQuestions', () => {
  it('accepts structurally valid questions', () => {
    expect(parseGeneratedQuestions(goodPayload)).toHaveLength(15);
  });

  it('rejects malformed entries but keeps the valid ones', () => {
    const payload = {
      questions: [
        goodQuestion(1),
        { question: 'Thiếu đáp án?', answers: ['A', 'B'], correct: 0 },
        { question: 'Trùng đáp án nè nha?', answers: ['X', 'X', 'Y', 'Z'], correct: 0 },
        { question: 'Chỉ số sai thì bỏ nhé?', answers: ['A', 'B', 'C', 'D'], correct: 4 },
        { question: 'ngắn', answers: ['A', 'B', 'C', 'D'], correct: 0 },
      ],
    };
    expect(parseGeneratedQuestions(payload)).toHaveLength(1);
  });

  it('returns empty for non-object payloads', () => {
    expect(parseGeneratedQuestions(null)).toEqual([]);
    expect(parseGeneratedQuestions('x')).toEqual([]);
    expect(parseGeneratedQuestions({ questions: 'no' })).toEqual([]);
  });
});

describe('generateQuizQuestions', () => {
  it('returns 15 questions from a valid completion', async () => {
    mockCompletion(JSON.stringify(goodPayload));
    const result = await generateQuizQuestions('key', []);
    expect(result).toHaveLength(15);
  });

  it('fails open on HTTP errors', async () => {
    mockCompletion('irrelevant', 500);
    await expect(generateQuizQuestions('key', [])).resolves.toBeNull();
  });

  it('fails open when too few questions validate', async () => {
    mockCompletion(JSON.stringify({ questions: [goodQuestion(1)] }));
    await expect(generateQuizQuestions('key', [])).resolves.toBeNull();
  });

  it('fails open on invalid JSON content', async () => {
    mockCompletion('not json at all');
    await expect(generateQuizQuestions('key', [])).resolves.toBeNull();
  });
});

describe('buildPrompt', () => {
  it('embeds recently asked questions to avoid', () => {
    const prompt = buildPrompt(['Thủ đô của Việt Nam là gì?']);
    expect(prompt).toContain('Thủ đô của Việt Nam là gì?');
    expect(prompt).toContain('15 câu hỏi');
  });

  it('spells out the one-correct-answer and no-subjective rules', () => {
    const prompt = buildPrompt([]);
    // The exact failure modes the owner flagged must be named as anti-patterns.
    expect(prompt).toContain('ĐÚNG MỘT đáp án đúng');
    expect(prompt).toContain('bò sát'); // the "which is a reptile" example
    expect(prompt).toContain('Quốc hoa'); // the not-officially-defined example
    expect(prompt).toMatch(/biểu tượng|tượng trưng/);
  });
});

describe('judgeQuestions', () => {
  const q = (question: string, correct = 0) => ({
    question,
    answers: ['a', 'b', 'c', 'd'],
    correct,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes questions the model flags and keeps the rest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdicts: [
                  { i: 0, ok: true, ly_do: 'rõ ràng' },
                  { i: 1, ok: false, ly_do: 'hai đáp án cùng đúng' },
                ],
              }),
            },
          },
        ],
      }),
    } as Response);
    const result = await judgeQuestions('key', [q('Thủ đô Pháp?'), q('Con nào là bò sát?')]);
    expect(result[0].ok).toBe(true);
    expect(result[1].ok).toBe(false);
  });

  it('fails open: an API error keeps every question', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);
    const result = await judgeQuestions('key', [q('x?'), q('y?')]);
    expect(result.every((r) => r.ok)).toBe(true);
  });

  it('keeps a question the model forgot to rate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ verdicts: [{ i: 0, ok: false }] }) } }] }),
    } as Response);
    const result = await judgeQuestions('key', [q('rated?'), q('unrated?')]);
    expect(result[0].ok).toBe(false);
    expect(result[1].ok).toBe(true); // not-rated -> kept
  });
});
