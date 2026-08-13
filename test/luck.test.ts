import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { LuckService } from '../src/services/luck.service';

let db: Db;
let luck: LuckService;

beforeEach(() => {
  db = createDb(':memory:');
  luck = new LuckService(db);
});

describe('luck factor', () => {
  it('defaults to none and clamps what it stores', () => {
    expect(luck.get('u1')).toBe(0);
    luck.set('u1', 1.7);
    expect(luck.get('u1')).toBe(1);
    luck.set('u1', -3);
    expect(luck.get('u1')).toBe(0);
  });

  it('removes the row when set back to zero', () => {
    luck.set('u1', 0.5);
    expect(luck.list()).toHaveLength(1);
    luck.set('u1', 0);
    expect(luck.list()).toEqual([]);
  });

  it('never grants a redo to an unfavoured player', () => {
    for (let i = 0; i < 100; i++) expect(luck.grantsRedo('nobody')).toBe(false);
  });
});

describe('favor', () => {
  it('leaves winning rounds untouched', () => {
    luck.set('u1', 1);
    let calls = 0;
    const result = luck.favor(
      'u1',
      () => {
        calls++;
        return 'win';
      },
      (r) => r === 'win',
    );
    expect(result).toBe('win');
    expect(calls).toBe(1);
  });

  it('replays a loss exactly once for a fully favoured player', () => {
    luck.set('u1', 1);
    const outcomes = ['lose', 'win', 'win'];
    let calls = 0;
    const result = luck.favor(
      'u1',
      () => outcomes[calls++],
      (r) => r === 'win',
    );
    expect(result).toBe('win');
    expect(calls).toBe(2);
  });

  it('keeps the second result even when it also loses', () => {
    luck.set('u1', 1);
    let calls = 0;
    const result = luck.favor(
      'u1',
      () => {
        calls++;
        return 'lose';
      },
      (r) => r === 'win',
    );
    expect(result).toBe('lose');
    expect(calls).toBe(2);
  });

  it('does not replay for players without luck', () => {
    let calls = 0;
    luck.favor(
      'u1',
      () => {
        calls++;
        return 'lose';
      },
      (r) => r === 'win',
    );
    expect(calls).toBe(1);
  });

  it('lifts a 50/50 game to roughly 75% at full luck', () => {
    luck.set('u1', 1);
    let wins = 0;
    for (let i = 0; i < 20_000; i++) {
      const won = luck.favor('u1', () => Math.random() < 0.5, (r) => r);
      if (won) wins++;
    }
    expect(wins / 20_000).toBeGreaterThan(0.72);
    expect(wins / 20_000).toBeLessThan(0.78);
  });
});
