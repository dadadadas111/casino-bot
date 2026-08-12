import { describe, expect, it } from 'vitest';
import {
  HORSE_COUNT,
  TRACK_LEN,
  generateHorses,
  pickWinner,
  renderTrack,
} from '../src/services/race.service';

describe('generateHorses', () => {
  it('produces 4 horses with unique names and probabilities summing to 1', () => {
    const horses = generateHorses();
    expect(horses).toHaveLength(HORSE_COUNT);
    expect(new Set(horses.map((h) => h.name)).size).toBe(HORSE_COUNT);
    const total = horses.reduce((sum, h) => sum + h.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('gives weaker horses higher odds with a ~10% house edge', () => {
    for (const horse of generateHorses()) {
      expect(horse.odds).toBeCloseTo(Math.round((0.9 / horse.weight) * 10) / 10, 5);
      expect(horse.odds).toBeGreaterThan(1);
    }
  });
});

describe('pickWinner', () => {
  it('respects the probability ordering over many races', () => {
    const horses = generateHorses();
    const favorite = horses.reduce((best, h, i) => (h.weight > horses[best].weight ? i : best), 0);
    const longshot = horses.reduce((worst, h, i) => (h.weight < horses[worst].weight ? i : worst), 0);
    const wins = Array<number>(HORSE_COUNT).fill(0);
    for (let i = 0; i < 20_000; i++) wins[pickWinner(horses)]++;
    expect(wins[favorite]).toBeGreaterThan(wins[longshot]);
    for (const count of wins) expect(count).toBeGreaterThan(0);
  });
});

describe('renderTrack', () => {
  it('renders one lane per horse with names and odds', () => {
    const horses = generateHorses();
    const lines = renderTrack([0, 5, TRACK_LEN - 1, TRACK_LEN], horses, 3).split('\n');
    expect(lines).toHaveLength(HORSE_COUNT);
    for (let i = 0; i < HORSE_COUNT; i++) {
      expect(lines[i]).toContain(horses[i].name);
      expect(lines[i]).toContain(`x${horses[i].odds}`);
      expect(lines[i]).toContain('🏇');
    }
    expect(lines[3]).toContain('👑');
  });
});
