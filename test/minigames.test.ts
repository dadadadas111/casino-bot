import { describe, expect, it } from 'vitest';
import {
  SLOT_SYMBOLS,
  type SlotSymbol,
  bauCuaPayout,
  coinflipPayout,
  evaluateSlots,
  rollBauCua,
  rollTaiXiu,
  slotsPayout,
  taiXiuPayout,
} from '../src/services/minigames.service';

describe('taixiu', () => {
  it('keeps rolls consistent with the tai/xiu/bao rules', () => {
    for (let i = 0; i < 500; i++) {
      const result = rollTaiXiu();
      expect(result.total).toBe(result.dice[0] + result.dice[1] + result.dice[2]);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeLessThanOrEqual(18);
      const triple = result.dice[0] === result.dice[1] && result.dice[1] === result.dice[2];
      if (triple) expect(result.outcome).toBe('bao');
      else expect(result.outcome).toBe(result.total >= 11 ? 'tai' : 'xiu');
    }
  });

  it('pays 1:1 on a correct guess, nothing on bao', () => {
    expect(taiXiuPayout({ dice: [4, 4, 5], total: 13, outcome: 'tai' }, 'tai', 100)).toBe(200);
    expect(taiXiuPayout({ dice: [1, 2, 3], total: 6, outcome: 'xiu' }, 'tai', 100)).toBe(0);
    expect(taiXiuPayout({ dice: [6, 6, 6], total: 18, outcome: 'bao' }, 'tai', 100)).toBe(0);
  });
});

describe('baucua', () => {
  it('pays per matching die and returns the stake', () => {
    expect(bauCuaPayout({ dice: ['cua', 'ga', 'nai'], matches: 1 }, 100)).toBe(200);
    expect(bauCuaPayout({ dice: ['cua', 'cua', 'nai'], matches: 2 }, 100)).toBe(300);
    expect(bauCuaPayout({ dice: ['cua', 'cua', 'cua'], matches: 3 }, 100)).toBe(400);
    expect(bauCuaPayout({ dice: ['ga', 'nai', 'tom'], matches: 0 }, 100)).toBe(0);
  });

  it('counts matches correctly', () => {
    for (let i = 0; i < 200; i++) {
      const result = rollBauCua('cua');
      expect(result.matches).toBe(result.dice.filter((d) => d === 'cua').length);
    }
  });
});

describe('coinflip', () => {
  it('pays 1:1', () => {
    expect(coinflipPayout({ side: 'ngua' }, 'ngua', 50)).toBe(100);
    expect(coinflipPayout({ side: 'sap' }, 'ngua', 50)).toBe(0);
  });
});

describe('slots', () => {
  it('classifies triples, pairs and misses', () => {
    expect(evaluateSlots(['7️⃣', '7️⃣', '7️⃣'])).toMatchObject({ kind: 'triple', multiplier: 100 });
    expect(evaluateSlots(['🍒', '🍒', '🍋'])).toMatchObject({ kind: 'pair', multiplier: 1 });
    expect(evaluateSlots(['🍒', '🍋', '💎'])).toMatchObject({ kind: 'none', multiplier: 0 });
  });

  it('has a house edge: RTP between 85% and 99%', () => {
    let totalPayout = 0;
    let outcomes = 0;
    for (const a of SLOT_SYMBOLS) {
      for (const b of SLOT_SYMBOLS) {
        for (const c of SLOT_SYMBOLS) {
          const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [a, b, c];
          totalPayout += slotsPayout(evaluateSlots(reels), 1);
          outcomes++;
        }
      }
    }
    const rtp = totalPayout / outcomes;
    expect(rtp).toBeGreaterThan(0.85);
    expect(rtp).toBeLessThan(0.99);
  });
});
