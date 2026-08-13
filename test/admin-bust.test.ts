import { describe, expect, it } from 'vitest';
import { ADMIN_ADD_CAP, ADMIN_SET_CAP, CHEAT_BUST_CHANCE, isCheatBusted } from '../src/services/enforcement.service';

describe('cheat busts', () => {
  it('busts below the threshold and lets the rest through', () => {
    expect(isCheatBusted(0)).toBe(true);
    expect(isCheatBusted(CHEAT_BUST_CHANCE - 0.001)).toBe(true);
    expect(isCheatBusted(CHEAT_BUST_CHANCE)).toBe(false);
    expect(isCheatBusted(0.999)).toBe(false);
  });

  it('keeps the odds meaningful but not hopeless', () => {
    expect(CHEAT_BUST_CHANCE).toBeGreaterThan(0.1);
    expect(CHEAT_BUST_CHANCE).toBeLessThan(0.6);
  });

  it('lands near the configured rate over many rolls', () => {
    let busted = 0;
    for (let i = 0; i < 20_000; i++) if (isCheatBusted()) busted++;
    expect(busted / 20_000).toBeCloseTo(CHEAT_BUST_CHANCE, 1);
  });
});

describe('admin caps', () => {
  it('keeps add small and set below what a top-up can buy', () => {
    expect(ADMIN_ADD_CAP).toBe(10_000);
    expect(ADMIN_SET_CAP).toBeGreaterThan(ADMIN_ADD_CAP);
  });
});
