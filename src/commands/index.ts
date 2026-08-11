import type { Command } from './types.js';
import { blackjackCommand } from './blackjack.command.js';
import { taixiuCommand } from './taixiu.command.js';
import { baucuaCommand } from './baucua.command.js';
import { coinflipCommand } from './coinflip.command.js';
import { slotsCommand } from './slots.command.js';
import { soduCommand } from './sodu.command.js';
import { dailyCommand } from './daily.command.js';
import { chuyentienCommand } from './chuyentien.command.js';
import { lichsuCommand } from './lichsu.command.js';
import { topCommand } from './top.command.js';
import { helpCommand } from './help.command.js';
import { adminCommand } from './admin.command.js';

const all: Command[] = [
  blackjackCommand,
  taixiuCommand,
  baucuaCommand,
  coinflipCommand,
  slotsCommand,
  soduCommand,
  dailyCommand,
  chuyentienCommand,
  lichsuCommand,
  topCommand,
  helpCommand,
  adminCommand,
];

export const commands = new Map<string, Command>(all.map((c) => [c.data.name, c]));
