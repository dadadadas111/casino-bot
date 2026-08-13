import { describe, expect, it } from 'vitest';
import {
  CHAMBERS,
  deathChance,
  simulateRound,
  survivorShare,
} from '../src/services/roulette.service';

/** Feeds a fixed sequence of rolls, then always survives. */
const rolls = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++] ?? 1;
};

describe('deathChance', () => {
  it('rises as chambers are spent and reaches certainty on the last one', () => {
    expect(deathChance(0)).toBeCloseTo(1 / 6);
    expect(deathChance(3)).toBeCloseTo(1 / 3);
    expect(deathChance(CHAMBERS - 1)).toBe(1);
  });
});

describe('simulateRound', () => {
  it('shoots the first player when the first pull is fatal', () => {
    const round = simulateRound(3, rolls([0]));
    expect(round.victimIndex).toBe(0);
    expect(round.pulls).toHaveLength(1);
    expect(round.pulls[0].died).toBe(true);
  });

  it('rotates turns between players', () => {
    const round = simulateRound(2, rolls([0.99, 0.99, 0]));
    expect(round.pulls.map((p) => p.player)).toEqual([0, 1, 0]);
    expect(round.victimIndex).toBe(0);
  });

  it('always ends with exactly one victim inside six pulls', () => {
    for (let players = 2; players <= 6; players++) {
      for (let trial = 0; trial < 200; trial++) {
        const round = simulateRound(players);
        expect(round.pulls.length).toBeLessThanOrEqual(CHAMBERS);
        expect(round.pulls.filter((p) => p.died)).toHaveLength(1);
        expect(round.pulls[round.pulls.length - 1].died).toBe(true);
        expect(round.victimIndex).toBeLessThan(players);
      }
    }
  });

  it('never spares everyone: the last chamber is always live', () => {
    const round = simulateRound(2, rolls([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]));
    expect(round.pulls).toHaveLength(CHAMBERS);
    expect(round.victimIndex).toBe((CHAMBERS - 1) % 2);
  });
});

describe('survivorShare', () => {
  it('splits the victim ante and floors the remainder', () => {
    expect(survivorShare(1_000, 1)).toBe(1_000);
    expect(survivorShare(1_000, 3)).toBe(333);
    expect(survivorShare(1_000, 0)).toBe(0);
  });
});
