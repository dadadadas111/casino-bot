import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService, WORK_COOLDOWN_MS } from '../src/services/economy.service';
import { BuffService } from '../src/services/buff.service';
import { AssetsService } from '../src/services/assets.service';
import {
  OVERDOSE_CAP,
  OVERDOSE_STEP,
  SAFE_CUPS,
  overdoseChance,
  windowExpired,
} from '../src/services/caffeine.service';

describe('overdose curve', () => {
  it('is free for the first few cups', () => {
    for (let cups = 1; cups <= SAFE_CUPS; cups++) {
      expect(overdoseChance(cups)).toBe(0);
    }
  });

  it('rises one step per cup past the safe count', () => {
    expect(overdoseChance(SAFE_CUPS + 1)).toBeCloseTo(OVERDOSE_STEP, 5);
    expect(overdoseChance(SAFE_CUPS + 2)).toBeCloseTo(OVERDOSE_STEP * 2, 5);
  });

  it('never exceeds the cap', () => {
    for (let cups = SAFE_CUPS; cups < 100; cups++) {
      expect(overdoseChance(cups)).toBeLessThanOrEqual(OVERDOSE_CAP);
    }
    expect(overdoseChance(1000)).toBe(OVERDOSE_CAP);
  });

  it('resets the window after an hour of no coffee', () => {
    const t0 = new Date('2026-08-20T10:00:00Z');
    expect(windowExpired(null, t0)).toBe(true);
    expect(windowExpired(t0.toISOString(), new Date(t0.getTime() + 59 * 60_000))).toBe(false);
    expect(windowExpired(t0.toISOString(), new Date(t0.getTime() + 61 * 60_000))).toBe(true);
  });
});

describe('drinking coffee', () => {
  let db: Db;
  let economy: EconomyService;
  const ME = 'coffee-addict';
  const T0 = new Date('2026-08-20T10:00:00Z');

  beforeEach(() => {
    db = createDb(':memory:');
    economy = new EconomyService(db, new BuffService(db), new AssetsService(db));
    economy.ensureUser(ME);
  });

  it('clears the work cooldown on a safe cup', () => {
    economy.work(ME, T0);
    expect(economy.work(ME, new Date(T0.getTime() + 60_000)).ok).toBe(false);
    // A cup with the roll well above the (zero) overdose chance is safe.
    const result = economy.drinkCoffee(ME, new Date(T0.getTime() + 61_000), 0.99);
    expect(result.overdosed).toBe(false);
    expect(economy.work(ME, new Date(T0.getTime() + 62_000)).ok).toBe(true);
  });

  it('counts cups within the window and forgets them after it', () => {
    economy.drinkCoffee(ME, T0, 0.99);
    economy.drinkCoffee(ME, new Date(T0.getTime() + 60_000), 0.99);
    expect(economy.caffeineCups(ME, new Date(T0.getTime() + 120_000))).toBe(2);
    // An hour past the LAST cup (drunk at +60s) the tally is clean again.
    expect(economy.caffeineCups(ME, new Date(T0.getTime() + 60_000 + 61 * 60_000))).toBe(0);
  });

  it('hospitalises an overdose and blocks work', () => {
    // Push past the safe count, then force the roll under the chance.
    for (let i = 0; i < SAFE_CUPS; i++) {
      economy.drinkCoffee(ME, new Date(T0.getTime() + i * 1000), 0.99);
    }
    const bad = economy.drinkCoffee(ME, new Date(T0.getTime() + SAFE_CUPS * 1000), 0.0);
    expect(bad.overdosed).toBe(true);
    expect(bad.until).toBeDefined();
    expect(economy.hospitalizedUntil(ME, new Date(T0.getTime() + SAFE_CUPS * 1000 + 1000))).not.toBeNull();
  });

  it('is impossible to overdose inside the safe count no matter the roll', () => {
    for (let i = 1; i <= SAFE_CUPS; i++) {
      const r = economy.drinkCoffee(ME, new Date(T0.getTime() + i * 1000), 0.0);
      expect(r.overdosed).toBe(false);
    }
  });

  it('counts a hospital visit so the medical fee escalates', () => {
    for (let i = 0; i < SAFE_CUPS; i++) economy.drinkCoffee(ME, new Date(T0.getTime() + i), 0.99);
    const before = economy.releaseFee(ME, 'hospital', T0);
    economy.drinkCoffee(ME, new Date(T0.getTime() + SAFE_CUPS), 0.0);
    expect(economy.releaseFee(ME, 'hospital', T0)).toBeGreaterThanOrEqual(before);
  });
});
