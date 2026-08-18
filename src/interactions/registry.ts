import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { CUSTOM_ID_ROOT, type ComponentHandler } from './ids.js';
import { blackjackComponents } from '../commands/blackjack.command.js';
import { keoComponents } from '../commands/keo.command.js';
import { trieuphuComponents } from '../commands/trieuphu.command.js';
import { duanguaComponents } from '../commands/duangua.command.js';
import { weddingComponents } from '../commands/marry.command.js';
import { honleComponents } from '../commands/honle.command.js';
import { helpComponents } from '../commands/help.command.js';
import { coquayComponents } from '../commands/coquay.command.js';
import { reviewComponents } from '../commands/duyetcau.command.js';

const handlers: Record<string, ComponentHandler> = {
  help: helpComponents,
  cq: coquayComponents,
  rev: reviewComponents,
  bj: blackjackComponents,
  keo: keoComponents,
  tp: trieuphuComponents,
  dn: duanguaComponents,
  wed: weddingComponents,
  hl: honleComponents,
};

export async function routeComponent(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  const [root, namespace, ...args] = interaction.customId.split(':');
  if (root !== CUSTOM_ID_ROOT || !namespace) return;

  const handler = handlers[namespace];
  if (interaction.isButton()) {
    await handler?.handleButton?.(interaction, args);
  } else {
    await handler?.handleModal?.(interaction, args);
  }
}
