import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { EconomyService } from '../src/services/economy.service';
import { ProfileService } from '../src/services/profile.service';

let db: Db;
let economy: EconomyService;
let profiles: ProfileService;

const GUILD_A = 'guild-a';
const GUILD_B = 'guild-b';

function join(userId: string, guildId: string): void {
  db.prepare(
    'INSERT OR REPLACE INTO user_guilds (user_id, guild_id, last_seen) VALUES (?, ?, ?)',
  ).run(userId, guildId, new Date().toISOString());
}

beforeEach(() => {
  db = createDb(':memory:');
  economy = new EconomyService(db);
  profiles = new ProfileService(db);

  // rich sits in another server entirely; mid and poor share guild A.
  for (const [id, balance, guild] of [
    ['rich', 9_000, GUILD_B],
    ['mid', 5_000, GUILD_A],
    ['poor', 1_000, GUILD_A],
  ] as const) {
    economy.ensureUser(id);
    economy.setBalance(id, balance);
    join(id, guild);
  }
});

describe('rank scoping', () => {
  it('ranks against the whole database when no guild is given', () => {
    expect(economy.getProfile('mid').rank).toBe(2);
    expect(economy.getProfile('poor').rank).toBe(3);
  });

  it('ignores richer players from other servers', () => {
    // "rich" only plays in guild B, so it must not push guild A members down.
    expect(economy.getProfile('mid', GUILD_A).rank).toBe(1);
    expect(economy.getProfile('poor', GUILD_A).rank).toBe(2);
  });

  it('gives the full profile the same scoping', () => {
    expect(profiles.get('mid').rank).toBe(2);
    expect(profiles.get('mid', GUILD_A).rank).toBe(1);
    expect(profiles.get('poor', GUILD_A).rank).toBe(2);
  });

  it('counts a player who belongs to both servers in each of them', () => {
    join('rich', GUILD_A);
    expect(economy.getProfile('mid', GUILD_A).rank).toBe(2);
    expect(economy.getProfile('rich', GUILD_A).rank).toBe(1);
    expect(economy.getProfile('rich', GUILD_B).rank).toBe(1);
  });

  it('puts a lone member of a server at the top of it', () => {
    expect(economy.getProfile('rich', GUILD_B).rank).toBe(1);
  });

  it('does not rank a viewer against a server they never played in', () => {
    expect(economy.getProfile('mid', GUILD_B).rank).toBe(2); // only rich counts
    expect(economy.getProfile('poor', GUILD_B).rank).toBe(2);
  });

  it('handles an unknown guild by ranking against nobody', () => {
    expect(economy.getProfile('poor', 'guild-does-not-exist').rank).toBe(1);
  });
});
