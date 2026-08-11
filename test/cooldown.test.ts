import { describe, expect, it } from 'vitest';
import { tryUse } from '../src/services/cooldown.service';

describe('tryUse', () => {
  it('allows the first use and blocks within the window', () => {
    expect(tryUse('a', 'game', 5_000, 1_000)).toBe(0);
    expect(tryUse('a', 'game', 5_000, 3_000)).toBe(3_000); // 6000 - 3000 remaining
  });

  it('allows again after the window expires', () => {
    expect(tryUse('b', 'game', 5_000, 1_000)).toBe(0);
    expect(tryUse('b', 'game', 5_000, 6_001)).toBe(0);
  });

  it('tracks users and keys independently', () => {
    expect(tryUse('c', 'game', 5_000, 1_000)).toBe(0);
    expect(tryUse('d', 'game', 5_000, 1_000)).toBe(0); // other user unaffected
    expect(tryUse('c', 'tuongtac', 15_000, 1_000)).toBe(0); // other key unaffected
    expect(tryUse('c', 'game', 5_000, 1_000)).toBeGreaterThan(0);
  });
});
