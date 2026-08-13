import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCommentaryPrompt,
  generateComments,
  parseComments,
} from '../src/services/commentary.service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildCommentaryPrompt', () => {
  it('numbers players and lists their facts', () => {
    const prompt = buildCommentaryPrompt([
      { facts: ['Số dư 10.000 xu', 'Được admin bơm 1.000.000 xu'] },
      { facts: ['Chuỗi điểm danh 3 ngày'] },
    ]);
    expect(prompt).toContain('Người chơi 1:');
    expect(prompt).toContain('- Được admin bơm 1.000.000 xu');
    expect(prompt).toContain('Người chơi 2:');
    expect(prompt).toContain('2 người chơi');
  });
});

describe('parseComments', () => {
  it('accepts a matching array of short strings', () => {
    expect(parseComments({ comments: ['a hay', 'b vui'] }, 2)).toEqual(['a hay', 'b vui']);
  });

  it('rejects wrong counts, empty or oversized comments', () => {
    expect(parseComments({ comments: ['một'] }, 2)).toBeNull();
    expect(parseComments({ comments: ['', 'b'] }, 2)).toBeNull();
    expect(parseComments({ comments: ['x'.repeat(200), 'b'] }, 2)).toBeNull();
    expect(parseComments('nope', 1)).toBeNull();
  });
});

describe('generateComments', () => {
  it('returns comments from a valid completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ comments: ['giàu ảo', 'chăm thật'] }) } }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      generateComments('key', [{ facts: ['a'] }, { facts: ['b'] }]),
    ).resolves.toEqual(['giàu ảo', 'chăm thật']);
  });

  it('fails open on errors and bad payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 500 }));
    await expect(generateComments('key', [{ facts: ['a'] }])).resolves.toBeNull();
  });

  it('short-circuits on empty player lists without calling the API', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(generateComments('key', [])).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
