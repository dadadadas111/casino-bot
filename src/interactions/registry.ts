import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { CUSTOM_ID_ROOT, type ComponentHandler } from './ids.js';
import { downtimeComponents } from './downtime.js';
import { blackjackComponents } from '../commands/blackjack.command.js';
import { trieuphuComponents } from '../commands/trieuphu.command.js';
import { duanguaComponents } from '../commands/duangua.command.js';
import { weddingComponents } from '../commands/cuoi.command.js';
import { honleComponents } from '../commands/honle.command.js';
import { helpComponents } from '../commands/help.command.js';
import { coquayComponents } from '../commands/coquay.command.js';
import { hiloComponents } from '../commands/hilo.command.js';
import { minesComponents } from '../commands/domin.command.js';
import { lobbyComponents } from '../commands/sanh.command.js';
import { questComponents } from '../commands/nhiemvu.command.js';
import { boardComponents } from '../commands/boardroom.command.js';
import { reviewComponents } from '../commands/duyetcau.command.js';
import { walletComponents } from '../commands/vi.command.js';
import { bagComponents } from '../commands/tuido.command.js';
import { figurineComponents } from '../commands/hinhnom.command.js';
import { configComponents } from '../commands/caidat.command.js';
import { ownerComponents } from '../commands/chubot.command.js';
import { lotteryComponents } from '../commands/xoso.command.js';

const handlers: Record<string, ComponentHandler> = {
  help: helpComponents,
  cq: coquayComponents,
  rev: reviewComponents,
  bj: blackjackComponents,
  hilo: hiloComponents,
  min: minesComponents,
  sanh: lobbyComponents,
  quest: questComponents,
  board: boardComponents,
  tp: trieuphuComponents,
  dn: duanguaComponents,
  wed: weddingComponents,
  hl: honleComponents,
  vi: walletComponents,
  bag: bagComponents,
  fig: figurineComponents,
  cfg: configComponents,
  own: ownerComponents,
  xs: lotteryComponents,
  free: downtimeComponents,
};

export async function routeComponent(
  interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
): Promise<void> {
  const [root, namespace, ...args] = interaction.customId.split(':');
  if (root !== CUSTOM_ID_ROOT || !namespace) return;

  const handler = handlers[namespace];
  if (!handler) return;
  if (interaction.isButton()) {
    await handler.handleButton?.(interaction, args);
  } else if (interaction.isModalSubmit()) {
    await handler.handleModal?.(interaction, args);
  } else {
    await handler.handleSelect?.(interaction, args);
  }
}
