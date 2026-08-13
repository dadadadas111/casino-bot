import type { Command } from './types.js';
import { blackjackCommand } from './blackjack.command.js';
import { taixiuCommand } from './taixiu.command.js';
import { baucuaCommand } from './baucua.command.js';
import { coinflipCommand } from './coinflip.command.js';
import { slotsCommand } from './slots.command.js';
import { keoCommand } from './keo.command.js';
import { duanguaCommand } from './duangua.command.js';
import { xosoCommand } from './xoso.command.js';
import { trieuphuCommand } from './trieuphu.command.js';
import { soduCommand } from './sodu.command.js';
import { dailyCommand } from './daily.command.js';
import { lamviecCommand } from './lamviec.command.js';
import { chuyentienCommand } from './chuyentien.command.js';
import { lichsuCommand } from './lichsu.command.js';
import { topCommand } from './top.command.js';
import { helpCommand } from './help.command.js';
import { adminCommand } from './admin.command.js';
import { setprefixCommand } from './setprefix.command.js';
import { bantinCommand } from './bantin.command.js';
import { bankCommand } from './bank.command.js';
import { nopphatCommand, tromCommand } from './trom.command.js';
import { muaCommand, shopCommand, tuidoCommand } from './shop.command.js';
import { cashCommand } from './cash.command.js';
import { cauhonCommand, lyhonCommand } from './marry.command.js';
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
  duanguaCommand,
  xosoCommand,
  trieuphuCommand,
  soduCommand,
  dailyCommand,
  lamviecCommand,
  chuyentienCommand,
  lichsuCommand,
  topCommand,
  helpCommand,
  adminCommand,
  setprefixCommand,
  bantinCommand,
  bankCommand,
  tromCommand,
  nopphatCommand,
  shopCommand,
  muaCommand,
  tuidoCommand,
  cashCommand,
  cauhonCommand,
  lyhonCommand,
  ...tuongtacCommands,
  alias(blackjackCommand, 'bj'),
  alias(taixiuCommand, 'tx'),
  alias(baucuaCommand, 'bc'),
  alias(coinflipCommand, 'cf'),
  alias(lamviecCommand, 'work'),
  alias(duanguaCommand, 'dn'),
  alias(xosoCommand, 'xs'),
];

export const commands = new Map<string, Command>(all.map((c) => [c.data.name, c]));
