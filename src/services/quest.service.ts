import type { Db } from '../db/database.js';
import {
  type Mission,
  type MissionEvent,
  gameEvents,
  missionById,
  pickMission,
} from './mission.service.js';

export const REROLL_AFTER_MS = 10 * 60 * 1000;

/** Only the economy bit quests needs, so the service stays testable. */
export interface QuestEconomy {
  credit(userId: string, amount: number, type: string, meta?: string): void;
}

interface QuestRow {
  mission_id: string;
  progress: number;
  completed: number;
  first_seen: string | null;
}

export interface QuestView {
  mission: Mission;
  progress: number;
  completed: boolean;
  /** True once 10 minutes have passed since the mission was first read. */
  canReroll: boolean;
  rerollAt: Date | null;
}

/**
 * One rolling mission per player. Progress ticks up automatically from game
 * and life events; the reward is claimed by button once the target is met. The
 * 10-minute reroll clock starts when the player first reads the mission, so a
 * mission they never looked at cannot be skipped instantly.
 */
export class QuestService {
  constructor(
    private db: Db,
    private economy: QuestEconomy,
  ) {}

  private row(userId: string): QuestRow {
    const existing = this.db
      .prepare('SELECT mission_id, progress, completed, first_seen FROM quests WHERE user_id = ?')
      .get(userId) as QuestRow | undefined;
    if (existing && missionById(existing.mission_id)) return existing;
    return this.assign(userId, null);
  }

  private assign(userId: string, exclude: string | null): QuestRow {
    const mission = pickMission(exclude);
    this.db
      .prepare(
        `INSERT INTO quests (user_id, mission_id, progress, completed, first_seen, assigned_at)
         VALUES (?, ?, 0, 0, NULL, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           mission_id = excluded.mission_id, progress = 0, completed = 0,
           first_seen = NULL, assigned_at = datetime('now')`,
      )
      .run(userId, mission.id);
    return { mission_id: mission.id, progress: 0, completed: 0, first_seen: null };
  }

  private toView(row: QuestRow, now: Date): QuestView {
    const mission = missionById(row.mission_id)!;
    const rerollAt = row.first_seen
      ? new Date(Date.parse(row.first_seen) + REROLL_AFTER_MS)
      : null;
    return {
      mission,
      progress: row.progress,
      completed: row.completed === 1,
      canReroll: rerollAt !== null && rerollAt.getTime() <= now.getTime() && row.completed === 0,
      rerollAt,
    };
  }

  /** View the mission and start the reroll clock (first read stamps the time). */
  view(userId: string, now: Date = new Date()): QuestView {
    const row = this.row(userId);
    if (!row.first_seen) {
      this.db
        .prepare('UPDATE quests SET first_seen = ? WHERE user_id = ?')
        .run(now.toISOString(), userId);
      row.first_seen = now.toISOString();
    }
    return this.toView(row, now);
  }

  /** Peek without stamping the clock (used by /recommend). */
  peek(userId: string, now: Date = new Date()): QuestView {
    return this.toView(this.row(userId), now);
  }

  /**
   * Advance the active mission if any of these events matches it. Returns the
   * mission that just became complete, or null. Never credits here — the reward
   * is claimed with a button.
   */
  record(userId: string, events: MissionEvent[], count = 1): Mission | null {
    const row = this.row(userId);
    if (row.completed === 1) return null;
    const mission = missionById(row.mission_id)!;
    if (!events.includes(mission.event)) return null;

    const progress = Math.min(mission.target, row.progress + count);
    const done = progress >= mission.target;
    this.db
      .prepare('UPDATE quests SET progress = ?, completed = ? WHERE user_id = ?')
      .run(progress, done ? 1 : 0, userId);
    return done ? mission : null;
  }

  /** Translate a settled game into its events and record them. */
  recordGame(userId: string, bet: number, payout: number, game: string): Mission | null {
    const events = gameEvents(bet, payout, game);
    return events.length > 0 ? this.record(userId, events) : null;
  }

  /** Claim a finished mission: pay out and roll a fresh one. */
  claim(userId: string): { ok: boolean; mission?: Mission; reward?: number } {
    const row = this.row(userId);
    if (row.completed !== 1) return { ok: false };
    const mission = missionById(row.mission_id)!;
    this.economy.credit(userId, mission.reward, 'quest', mission.id);
    this.assign(userId, mission.id);
    return { ok: true, mission, reward: mission.reward };
  }

  /** Swap the current mission, allowed 10 minutes after it was first read. */
  reroll(userId: string, now: Date = new Date()): { ok: boolean; rerollAt?: Date } {
    const row = this.row(userId);
    if (row.completed === 1) return { ok: false };
    if (!row.first_seen) {
      // Not read yet: stamp it now so the clock starts, but do not skip.
      this.db.prepare('UPDATE quests SET first_seen = ? WHERE user_id = ?').run(now.toISOString(), userId);
      return { ok: false, rerollAt: new Date(now.getTime() + REROLL_AFTER_MS) };
    }
    const rerollAt = new Date(Date.parse(row.first_seen) + REROLL_AFTER_MS);
    if (rerollAt.getTime() > now.getTime()) return { ok: false, rerollAt };
    this.assign(userId, row.mission_id);
    return { ok: true };
  }
}
