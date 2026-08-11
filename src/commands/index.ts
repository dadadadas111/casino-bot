import type { Command } from './types.js';
import { blackjackCommand } from './blackjack.command.js';
import { taixiuCommand } from './taixiu.command.js';
import { baucuaCommand } from './baucua.command.js';
import { coinflipCommand } from './coinflip.command.js';
import { slotsCommand } from './slots.command.js';
import { keoCommand } from './keo.command.js';
import { soduCommand } from './sodu.command.js';
import { dailyCommand } from './daily.command.js';
import { lamviecCommand } from './lamviec.command.js';
import { chuyentienCommand } from './chuyentien.command.js';
import { lichsuCommand } from './lichsu.command.js';
import { topCommand } from './top.command.js';
import { helpCommand } from './help.command.js';
import { adminCommand } from './admin.command.js';
import { tuongtacCommands } from './tuongtac.command.js';

/** Register a command under an extra short name (same options, same handler). */
function alias(command: Command, name: string): Command {
  return {
    data: {
      name,
      toJSON: () => ({ ...(command.data.toJSON() as Record<string, unknown>), name }),
    },
    execute: command.execute,
  };
}

const all: Command[] = [
  blackjackCommand,
  taixiuCommand,
  baucuaCommand,
  coinflipCommand,
  slotsCommand,
  keoCommand,
  soduCommand,
  dailyCommand,
  lamviecCommand,
  chuyentienCommand,
  lichsuCommand,
  topCommand,
  helpCommand,
  adminCommand,
  ...tuongtacCommands,
  alias(blackjackCommand, 'bj'),
  alias(taixiuCommand, 'tx'),
  alias(baucuaCommand, 'bc'),
  alias(coinflipCommand, 'cf'),
  alias(lamviecCommand, 'work'),
];

export const commands = new Map<string, Command>(all.map((c) => [c.data.name, c]));
