import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { BuffService } from '../src/services/buff.service';
import { AssetsService } from '../src/services/assets.service';
import { rankFor } from '../src/services/job.service';
import {
  BOARD_CHANCE,
  CHUTICH_FLOOR,
  SCENARIOS,
  demoteFloor,
  demotionChance,
  rollOutcome,
} from '../src/services/boardroom.service';

describe('scenario integrity', () => {
  it('gives every option at least one outcome and every scenario at least two options', () => {
    for (const s of SCENARIOS) {
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      for (const o of s.options) {
        expect(o.outcomes.length).toBeGreaterThanOrEqual(1);
        expect(o.outcomes.every((x) => x.weight > 0)).toBe(true);
      }
    }
  });

  it('only ever demotes from an option flagged risky', () => {
    for (const s of SCENARIOS) {
      for (const o of s.options) {
        const hasDemote = o.outcomes.some((x) => x.effect.kind === 'demote');
        if (hasDemote) expect(o.risky).toBe(true);
      }
    }
  });

  it('points every demotion at a real, lower rank', () => {
    for (const s of SCENARIOS) {
      for (const o of s.options) {
        for (const x of o.outcomes) {
          if (x.effect.kind === 'demote') {
            expect(demoteFloor(x.effect.toRank)).toBeLessThan(CHUTICH_FLOOR);
          }
        }
      }
    }
  });

  it('has at least one clear, one luck and one risk scenario', () => {
    const kinds = new Set(SCENARIOS.map((s) => s.kind));
    expect(kinds.has('clear')).toBe(true);
    expect(kinds.has('luck')).toBe(true);
    expect(kinds.has('risk')).toBe(true);
  });

  it('never lets a safe option cause a demotion', () => {
    for (const s of SCENARIOS) {
      for (const o of s.options) {
        if (!o.risky) expect(demotionChance(o)).toBe(0);
      }
    }
  });
});

describe('rollOutcome', () => {
  const outcomes = [
    { weight: 1, effect: { kind: 'pay' as const, mult: 2 }, text: 'a' },
    { weight: 3, effect: { kind: 'pay' as const, mult: 0 }, text: 'b' },
  ];

  it('lands in the first bucket at the low end', () => {
    expect(rollOutcome(outcomes, 0).text).toBe('a');
    expect(rollOutcome(outcomes, 0.24).text).toBe('a');
  });

  it('crosses into the second bucket past its share', () => {
    expect(rollOutcome(outcomes, 0.26).text).toBe('b');
    expect(rollOutcome(outcomes, 0.99).text).toBe('b');
  });

  it('roughly matches the weights over many rolls', () => {
    let a = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (rollOutcome(outcomes, i / N).text === 'a') a++;
    expect(a / N).toBeCloseTo(0.25, 1);
  });
});

describe('board shift economy', () => {
  let db: Db;
  let economy: EconomyService;
  const ME = 'ceo';
  const T0 = new Date('2026-08-20T10:00:00Z');

  beforeEach(() => {
    db = createDb(':memory:');
    economy = new EconomyService(db, new BuffService(db), new AssetsService(db));
    economy.ensureUser(ME);
    // Seed a CEO by logging 500 shifts of career progress.
    db.prepare('UPDATE users SET work_count = ? WHERE user_id = ?').run(CHUTICH_FLOOR, ME);
  });

  it('spends the cooldown and counts the shift without paying', () => {
    const balance = economy.getBalance(ME);
    const begun = economy.beginBoardShift(ME, T0);
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(economy.getBalance(ME)).toBe(balance); // not paid yet
    expect(economy.workShifts(ME)).toBe(CHUTICH_FLOOR + 1);
    // The cooldown is now in effect.
    const second = economy.beginBoardShift(ME, new Date(T0.getTime() + 60_000));
    expect(second.ok).toBe(false);
  });

  it('settles the chosen wage, taxed and logged like a normal shift', () => {
    const begun = economy.beginBoardShift(ME, T0);
    if (!begun.ok) return;
    const balance = economy.getBalance(ME);
    const { net } = economy.settleBoardWage(ME, begun.gross * 2, T0);
    expect(economy.getBalance(ME)).toBe(balance + net);
    const { entries } = economy.getHistory(ME, 20);
    expect(entries.some((e) => e.type === 'work' && e.meta === 'board')).toBe(true);
  });

  it('demotes a bankrupt CEO down the ladder', () => {
    economy.demote(ME, demoteFloor('nhanvien'));
    expect(rankFor(economy.workShifts(ME)).key).toBe('nhanvien');
    expect(economy.workShifts(ME)).toBeLessThan(CHUTICH_FLOOR);
  });

  it('keeps the board chance sane', () => {
    expect(BOARD_CHANCE).toBeGreaterThan(0);
    expect(BOARD_CHANCE).toBeLessThanOrEqual(1);
  });
});
