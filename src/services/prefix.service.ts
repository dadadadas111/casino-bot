import type { Db } from '../db/database.js';

export const DEFAULT_PREFIX = '!';

/** 1-5 visible chars, no whitespace, no '/' (slash belongs to Discord), no mentions. */
export function isValidPrefix(prefix: string): boolean {
  return (
    prefix.length >= 1 &&
    prefix.length <= 5 &&
    !/\s/.test(prefix) &&
    !prefix.startsWith('/') &&
    !prefix.includes('@') &&
    !prefix.includes('#')
  );
}

/** Split "<prefix>cmd arg1 arg2" into name + args; null when not a command. */
export function parseTextCommand(
  content: string,
  prefix: string,
): { name: string; args: string[] } | null {
  if (!content.startsWith(prefix)) return null;
  const parts = content.slice(prefix.length).trim().split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if (!name) return null;
  return { name, args: parts.slice(1) };
}

export class PrefixStore {
  private cache = new Map<string, string>();

  constructor(private db: Db) {}

  get(guildId: string): string {
    const cached = this.cache.get(guildId);
    if (cached !== undefined) return cached;
    const row = this.db
      .prepare('SELECT prefix FROM guild_prefixes WHERE guild_id = ?')
      .get(guildId) as { prefix: string } | undefined;
    const prefix = row?.prefix ?? DEFAULT_PREFIX;
    this.cache.set(guildId, prefix);
    return prefix;
  }

  set(guildId: string, prefix: string): void {
    this.db
      .prepare(
        'INSERT INTO guild_prefixes (guild_id, prefix) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix',
      )
      .run(guildId, prefix);
    this.cache.set(guildId, prefix);
  }
}
