import type { ButtonInteraction } from 'discord.js';
import { CUSTOM_ID_ROOT, type ComponentHandler } from './ids.js';
import { blackjackComponents } from '../commands/blackjack.command.js';
import { keoComponents } from '../commands/keo.command.js';
import { trieuphuComponents } from '../commands/trieuphu.command.js';

const handlers: Record<string, ComponentHandler> = {
  bj: blackjackComponents,
  keo: keoComponents,
  tp: trieuphuComponents,
};

export async function routeComponent(interaction: ButtonInteraction): Promise<void> {
  const [root, namespace, ...args] = interaction.customId.split(':');
  if (root !== CUSTOM_ID_ROOT || !namespace) return;

  const handler = handlers[namespace];
  await handler?.handleButton?.(interaction, args);
}
