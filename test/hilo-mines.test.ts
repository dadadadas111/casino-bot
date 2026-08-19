import { describe, expect, it } from 'vitest';
import { RANK_ORDER, drawCard } from '../src/services/cards.js';
import {
  HILO_MAX_TOTAL,
  HILO_MIN_MULTIPLIER,
  isCorrect,
  multiplierFor,
  outcomeCounts,
  rankValue,
  cappedTotal,
  drawDifferent,
} from '../src/services/hilo.service.js';
import {
  MINES_COUNT,
  MINES_SAFE,
  MINES_TILES,
  layMines,
  multiplierAfter,
} from '../src/services/mines.service.js';

describe('hi-lo odds', () => {
  it('orders the ranks from ace low to king high', () => {
    expect(rankValue('A')).toBe(1);
    expect(rankValue('10')).toBe(10);
    expect(rankValue('K')).toBe(13);
  });

  it('counts what beats and what loses to each card', () => {
    expect(outcomeCounts('A')).toEqual({ cao: 12, thap: 0 });
    expect(outcomeCounts('K')).toEqual({ cao: 0, thap: 12 });
    expect(outcomeCounts('7')).toEqual({ cao: 6, thap: 6 });
  });

  it('refuses the impossible guess instead of taking the money', () => {
    expect(multiplierFor('A', 'thap')).toBeNull();
    expect(multiplierFor('K', 'cao')).toBeNull();
  });

  it('pays more the less likely the guess is', () => {
    const cheap = multiplierFor('2', 'cao');
    const dear = multiplierFor('2', 'thap');
    expect(dear).toBeGreaterThan(cheap!);
    // Only the ace loses to a 2, so it is the longest shot on the board.
    expect(dear).toBeCloseTo(11.64, 2);
  });

  it('is symmetric around the seven', () => {
    expect(multiplierFor('7', 'cao')).toBe(multiplierFor('7', 'thap'));
    for (let i = 0; i < 13; i++) {
      const low = RANK_ORDER[i];
      const high = RANK_ORDER[12 - i];
      expect(multiplierFor(low, 'cao')).toBe(multiplierFor(high, 'thap'));
    }
  });

  it('never offers a multiplier that loses money on a sure thing', () => {
    for (const rank of RANK_ORDER) {
      for (const choice of ['cao', 'thap'] as const) {
        const m = multiplierFor(rank, choice);
        if (m !== null) expect(m).toBeGreaterThanOrEqual(HILO_MIN_MULTIPLIER);
      }
    }
  });

  it('keeps the house edge on every real guess', () => {
    // Expected return = probability of winning * multiplier.
    for (const rank of RANK_ORDER) {
      for (const choice of ['cao', 'thap'] as const) {
        const winning = outcomeCounts(rank)[choice];
        const m = multiplierFor(rank, choice);
        if (m === null || winning === 12) continue; // the sure thing is the one gift
        expect((winning / 12) * m).toBeLessThan(1);
      }
    }
  });

  it('judges guesses against the ranks, not the suits', () => {
    expect(isCorrect('7', 'K', 'cao')).toBe(true);
    expect(isCorrect('7', '2', 'cao')).toBe(false);
    expect(isCorrect('7', '2', 'thap')).toBe(true);
  });

  it('never deals a tie back to the table', () => {
    for (let i = 0; i < 300; i++) {
      expect(drawDifferent('7').rank).not.toBe('7');
    }
  });

  it('caps a runaway streak', () => {
    expect(cappedTotal(1e6)).toBe(HILO_MAX_TOTAL);
    expect(cappedTotal(3.2)).toBe(3.2);
  });
});

describe('mines odds', () => {
  it('pays nothing extra before the first reveal', () => {
    expect(multiplierAfter(0)).toBe(1);
  });

  it('grows with every safe tile', () => {
    let previous = 0;
    for (let k = 1; k <= MINES_SAFE; k++) {
      const m = multiplierAfter(k);
      expect(m).toBeGreaterThan(previous);
      previous = m;
    }
  });

  it('keeps a house edge at every stopping point', () => {
    // Surviving k reveals has probability C(safe,k)/C(tiles,k); the payout
    // times that probability must stay under the stake.
    let survive = 1;
    for (let k = 1; k <= MINES_SAFE; k++) {
      survive *= (MINES_SAFE - (k - 1)) / (MINES_TILES - (k - 1));
      expect(survive * multiplierAfter(k)).toBeLessThan(1);
    }
  });

  it('opens the first tile at a modest premium and the last at a fortune', () => {
    expect(multiplierAfter(1)).toBeCloseTo(1.18, 2);
    expect(multiplierAfter(MINES_SAFE)).toBeGreaterThan(500);
  });

  it('lays exactly the right number of mines, all on the board', () => {
    for (let i = 0; i < 200; i++) {
      const mines = layMines();
      expect(mines).toHaveLength(MINES_COUNT);
      expect(new Set(mines).size).toBe(MINES_COUNT);
      for (const m of mines) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThan(MINES_TILES);
      }
    }
  });

  it('spreads the mines over every tile across many rounds', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) for (const m of layMines()) seen.add(m);
    expect(seen.size).toBe(MINES_TILES);
  });
});

describe('cards', () => {
  it('draws only real cards', () => {
    for (let i = 0; i < 200; i++) {
      const c = drawCard();
      expect(RANK_ORDER).toContain(c.rank);
      expect(['♠', '♥', '♦', '♣']).toContain(c.suit);
    }
  });
});
