import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { QuestService, REROLL_AFTER_MS } from '../src/services/quest.service';
import { MISSIONS, gameEvents, missionById, pickMission } from '../src/services/mission.service';

describe('mission catalogue', () => {
  it('has unique ids and small rewards', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(m.reward).toBeGreaterThan(0);
      expect(m.reward).toBeLessThanOrEqual(2_000); // below a work shift
      expect(m.target).toBeGreaterThan(0);
    }
  });

  it('never re-picks the excluded mission', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickMission('play3').id).not.toBe('play3');
    }
  });

  it('emits play/win/bigwin events only for real bets', () => {
    expect(gameEvents(0, 5000, 'trieuphu')).toEqual([]); // free game, no events
    expect(gameEvents(100, 0, 'slots')).toEqual(['play', 'play:slots']);
    expect(gameEvents(100, 150, 'taixiu')).toEqual(['play', 'play:taixiu', 'win', 'win:taixiu']);
    expect(gameEvents(100, 200, 'blackjack')).toContain('bigwin');
  });
});

describe('quest service', () => {
  let db: Db;
  let quests: QuestService;
  let credited: Array<{ amount: number; meta?: string }>;
  const ME = 'player';
  const T0 = new Date('2026-08-21T10:00:00Z');

  beforeEach(() => {
    db = createDb(':memory:');
    credited = [];
    quests = new QuestService(db, {
      credit: (_u, amount, _t, meta) => credited.push({ amount, meta }),
    });
  });

  it('assigns a mission on first view', () => {
    const v = quests.view(ME, T0);
    expect(missionById(v.mission.id)).toBeDefined();
    expect(v.progress).toBe(0);
    expect(v.completed).toBe(false);
  });

  it('only advances on a matching event', () => {
    const v = quests.view(ME, T0);
    // A non-matching event does nothing.
    quests.record(ME, ['daily']);
    if (v.mission.event !== 'daily') {
      expect(quests.peek(ME, T0).progress).toBe(0);
    }
    // The matching event advances toward the target.
    quests.record(ME, [v.mission.event]);
    expect(quests.peek(ME, T0).progress).toBe(Math.min(1, v.mission.target));
  });

  it('completes when the target is reached, then pays only on claim', () => {
    const v = quests.view(ME, T0);
    for (let i = 0; i < v.mission.target; i++) quests.record(ME, [v.mission.event]);
    expect(quests.peek(ME, T0).completed).toBe(true);
    expect(credited).toHaveLength(0); // not paid until claimed

    const claim = quests.claim(ME);
    expect(claim.ok).toBe(true);
    expect(credited).toEqual([{ amount: v.mission.reward, meta: v.mission.id }]);
    // A fresh, different mission is assigned.
    expect(quests.peek(ME, T0).mission.id).not.toBe(v.mission.id);
    expect(quests.peek(ME, T0).completed).toBe(false);
  });

  it('refuses to claim an unfinished mission', () => {
    quests.view(ME, T0);
    expect(quests.claim(ME).ok).toBe(false);
    expect(credited).toHaveLength(0);
  });

  it('blocks reroll until 10 minutes after the first read', () => {
    quests.view(ME, T0); // stamps first_seen
    expect(quests.reroll(ME, new Date(T0.getTime() + REROLL_AFTER_MS - 1000)).ok).toBe(false);
    const before = quests.peek(ME, T0).mission.id;
    const ok = quests.reroll(ME, new Date(T0.getTime() + REROLL_AFTER_MS + 1000));
    expect(ok.ok).toBe(true);
    expect(quests.peek(ME, T0).mission.id).not.toBe(before);
  });

  it('starts the reroll clock from first read, not assignment', () => {
    // peek does not stamp the clock, so reroll at +10min still cannot fire; it
    // only stamps first_seen now.
    quests.peek(ME, T0);
    expect(quests.reroll(ME, new Date(T0.getTime() + REROLL_AFTER_MS)).ok).toBe(false);
    // Ten minutes after that stamp, the swap is allowed.
    expect(quests.reroll(ME, new Date(T0.getTime() + 2 * REROLL_AFTER_MS + 1000)).ok).toBe(true);
  });

  it('cannot reroll a completed mission', () => {
    const v = quests.view(ME, T0);
    for (let i = 0; i < v.mission.target; i++) quests.record(ME, [v.mission.event]);
    expect(quests.reroll(ME, new Date(T0.getTime() + 2 * REROLL_AFTER_MS)).ok).toBe(false);
  });
});
