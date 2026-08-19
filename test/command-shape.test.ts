import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guard for the command reorganisation: the slash list is meant to
 * be flat and every name unique. Reading the sources keeps this test free of
 * the bot environment, which command modules pull in transitively.
 */
const COMMAND_DIR = join(import.meta.dirname, '../src/commands');
const sources = readdirSync(COMMAND_DIR)
  .filter((f) => f.endsWith('.command.ts'))
  .map((f) => ({ file: f, text: readFileSync(join(COMMAND_DIR, f), 'utf8') }));

// Only builder roots count; option names use the same setName call.
const names = sources.flatMap(({ file, text }) =>
  [...text.matchAll(/new SlashCommandBuilder\(\)\s*\.setName\('([a-z0-9-]+)'\)/g)].map((m) => ({
    file,
    name: m[1],
  })),
);

// The interaction commands are generated from a table rather than written out.
const generated = [
  ...readFileSync(join(COMMAND_DIR, 'tuongtac.command.ts'), 'utf8').matchAll(
    /^\s{4}name: '([a-z]+)',$/gm,
  ),
].map((m) => ({ file: 'tuongtac.command.ts', name: m[1] }));

const allNames = [...names, ...generated];

describe('slash command shape', () => {
  it('registers no nested subcommands anywhere', () => {
    const offenders = sources
      .filter(({ text }) => text.includes('.addSubcommand('))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('declares every command name only once', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const { file, name } of allNames) {
      const previous = seen.get(name);
      if (previous) clashes.push(`${name}: ${previous} + ${file}`);
      else seen.set(name, file);
    }
    expect(clashes).toEqual([]);
  });

  it('keeps the commands players use most as their own entry point', () => {
    const declared = new Set(allNames.map((n) => n.name));
    for (const name of ['sodu', 'shop', 'nap', 'om', 'hon', 'danh', 'choc', 'xoadau', 'doino',
      'hilo', 'domin', 'sanh']) {
      expect(declared).toContain(name);
    }
  });

  it('lands on the agreed command count', () => {
    // 35 builders here, plus the /bj alias registered in index.ts: 36 in the
    // home guild, 35 everywhere else once /chubot is filtered out.
    expect(allNames).toHaveLength(35);
  });

  it('drops the commands that were folded into panels', () => {
    const declared = new Set(allNames.map((n) => n.name));
    for (const name of ['bank', 'cash', 'mua', 'dungdo', 'tang', 'lichsu', 'nopphat', 'vienphi',
      'cauhon', 'lyhon', 'honle', 'setprefix', 'doiten', 'casino-admin', 'luck', 'backup',
      'coinflip', 'keo']) {
      expect(declared).not.toContain(name);
    }
  });
});
