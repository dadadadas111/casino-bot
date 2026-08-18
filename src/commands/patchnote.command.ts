import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { LATEST_PATCH } from '../data/patch-notes.js';
import { patchEmbed } from '../patch-announcer.js';
import type { Command } from './types.js';

export const patchnoteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('patchnote')
    .setDescription('Bot vừa thêm gì mới (bật/tắt thông báo trong /caidat)'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({ embeds: [patchEmbed(LATEST_PATCH)] });
  },
};
