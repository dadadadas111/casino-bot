import type { Command } from './types.js';
import { blackjackCommand } from './blackjack.command.js';
import { taixiuCommand } from './taixiu.command.js';
import { baucuaCommand } from './baucua.command.js';
import { slotsCommand } from './slots.command.js';
import { hiloCommand } from './hilo.command.js';
import { dominCommand } from './domin.command.js';
import { sanhCommand } from './sanh.command.js';
import { duanguaCommand } from './duangua.command.js';
import { xosoCommand } from './xoso.command.js';
import { trieuphuCommand } from './trieuphu.command.js';
import { coquayCommand } from './coquay.command.js';
import { viCommand, soduCommand } from './vi.command.js';
import { napCommand } from './nap.command.js';
import { hosoCommand } from './hoso.command.js';
import { dailyCommand } from './daily.command.js';
import { lamviecCommand } from './lamviec.command.js';
import { chuyentienCommand } from './chuyentien.command.js';
import { topCommand } from './top.command.js';
import { helpCommand } from './help.command.js';
import { bantinCommand } from './bantin.command.js';
import { patchnoteCommand } from './patchnote.command.js';
import { caidatCommand } from './caidat.command.js';
import { chubotCommand } from './chubot.command.js';
import { tromCommand } from './trom.command.js';
import { shopCommand, tuidoCommand } from './tuido.command.js';
import { cuoiCommand } from './cuoi.command.js';
import { hinhnomCommand } from './hinhnom.command.js';
import { tuongtacCommands } from './tuongtac.command.js';
import { doinoCommand } from './doino.command.js';

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

/**
 * Owner tooling is registered to the home guild only. Elsewhere it used to
 * show up greyed out for every server admin, which was both clutter and a
 * needless advertisement that the bot has a back door.
 */
export const OWNER_ONLY_COMMANDS = new Set(['chubot']);

const all: Command[] = [
  // The lobby comes first: it is the answer to a crowded slash picker.
  sanhCommand,
  // Games keep their own top-level names: this is the shortest path to the
  // thing people open the bot for, and a picker would only lengthen it.
  blackjackCommand,
  taixiuCommand,
  baucuaCommand,
  slotsCommand,
  hiloCommand,
  dominCommand,
  duanguaCommand,
  xosoCommand,
  trieuphuCommand,
  coquayCommand,
  // Money.
  viCommand,
  soduCommand,
  napCommand,
  chuyentienCommand,
  topCommand,
  hosoCommand,
  dailyCommand,
  lamviecCommand,
  // Life.
  tuidoCommand,
  shopCommand,
  cuoiCommand,
  hinhnomCommand,
  tromCommand,
  doinoCommand,
  ...tuongtacCommands,
  // Meta.
  helpCommand,
  bantinCommand,
  patchnoteCommand,
  caidatCommand,
  chubotCommand,
  // Blackjack is button-driven, so the typed layer cannot stand in for it.
  // Every other short form lives on there instead (!tx, !bc, !cf, !sl, !dn,
  // !xs, !work) and no longer takes up a slot in the slash list.
  alias(blackjackCommand, 'bj'),
];

export const commands = new Map<string, Command>(all.map((c) => [c.data.name, c]));
