import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Discord rejects a whole message when any button carries something that is
 * not a real emoji, and it does it at send time rather than at build time.
 * The playing-card symbol 🂡 looks like a card but is not in the emoji set,
 * and it took the lobby down. This scans every button emoji in the source.
 */
const SRC = join(import.meta.dirname, '../src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

/** Real emoji either carry emoji presentation, or ask for it with U+FE0F. */
function isRealEmoji(text: string): boolean {
  return /\p{Emoji_Presentation}/u.test(text) || text.includes('️');
}

/**
 * Three shapes reach a button: a literal `.setEmoji('x')`, an `emoji:` field
 * in a table the buttons are built from, and the lobby's `game(key, label,
 * emoji)` helper. The first version of this test only checked the first
 * shape and sailed straight past the bug it was written for.
 */
const PATTERNS = [
  /\.setEmoji\('([^']+)'\)/g,
  /\bemoji: '([^']+)'/g,
  /\bgame\('[^']*', '[^']*', '([^']+)'/g,
];

const used = walk(SRC).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((m) => ({ file: file.slice(SRC.length + 1), emoji: m[1] })),
  );
});

describe('button emoji', () => {
  it('finds the buttons to check', () => {
    expect(used.length).toBeGreaterThan(20);
  });

  it('never puts a non-emoji on a button', () => {
    const bad = used.filter((u) => !isRealEmoji(u.emoji)).map((u) => `${u.file}: ${u.emoji}`);
    expect(bad).toEqual([]);
  });

  it('rejects the playing-card symbols that broke the lobby', () => {
    // 🂡 U+1F0A1 renders like a card but Discord refuses it.
    expect(isRealEmoji('🂡')).toBe(false);
    expect(isRealEmoji('🃏')).toBe(true);
    expect(isRealEmoji('⬆️')).toBe(true);
  });
});
