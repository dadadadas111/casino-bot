import type { Db } from '../db/database.js';
import { EFFECTS, type EffectKind } from './effects.service.js';

/**
 * Owner-tunable knobs. Each knob has a coded default and hard bounds; the DB
 * only stores overrides. Reading an unset knob returns the default, so the bot
 * behaves identically until the owner changes something. Values are clamped to
 * [min, max] on both read and write, so a bad row can never break the game.
 */
export interface ConfigKnob {
  key: string;
  label: string;
  def: number;
  min: number;
  max: number;
  group: string;
}

// One floor-price knob per server-allowed effect, defaulted from the registry.
const effectFloorKnobs: ConfigKnob[] = Object.values(EFFECTS)
  .filter((e) => e.serverAllowed && e.floor > 0)
  .map((e) => ({
    key: `floor.${e.kind}`,
    label: `Giá sàn item server: ${e.label}`,
    def: e.floor,
    min: 1,
    max: 1_000_000,
    group: 'Giá sàn effect (item server)',
  }));

export const CONFIG_KNOBS: ConfigKnob[] = [...effectFloorKnobs];

const KNOB_BY_KEY = new Map(CONFIG_KNOBS.map((k) => [k.key, k]));

function clampKnob(value: number, knob: ConfigKnob): number {
  const n = Math.round(Number.isFinite(value) ? value : knob.def);
  return Math.min(knob.max, Math.max(knob.min, n));
}

export class ConfigService {
  private cache = new Map<string, number>();
  constructor(private db: Db) {}

  /** Numeric knob value, clamped to bounds, falling back to the coded default. */
  getInt(key: string): number {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const knob = KNOB_BY_KEY.get(key);
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    const raw = row ? Number(row.value) : (knob?.def ?? 0);
    const val = knob ? clampKnob(raw, knob) : Math.round(raw);
    this.cache.set(key, val);
    return val;
  }

  set(key: string, value: number): void {
    const knob = KNOB_BY_KEY.get(key);
    const val = knob ? clampKnob(value, knob) : Math.round(value);
    this.db
      .prepare(
        `INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, String(val));
    this.cache.set(key, val);
  }

  /** Minimum price a server item carrying this effect may be sold for. */
  effectFloor(kind: EffectKind): number {
    return this.getInt(`floor.${kind}`);
  }
}
