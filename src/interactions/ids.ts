import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';

/**
 * Component customId convention: `cs:<namespace>:<...args>`.
 * The registry routes on <namespace>; handlers interpret the rest.
 */
export const CUSTOM_ID_ROOT = 'cs';

export function componentId(...parts: string[]): string {
  return [CUSTOM_ID_ROOT, ...parts].join(':');
}

export interface ComponentHandler {
  handleButton?(interaction: ButtonInteraction, args: string[]): Promise<void>;
  handleModal?(interaction: ModalSubmitInteraction, args: string[]): Promise<void>;
  handleSelect?(interaction: AnySelectMenuInteraction, args: string[]): Promise<void>;
}
