import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buildReportEmbed } from '../report-scheduler.js';
import type { Command } from './types.js';

export const bantinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bantin')
    .setDescription('Bản tin sòng bạc: top 10, thống kê 24h, jackpot (cấu hình trong /caidat)'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // AI commentary can take a few seconds on the first build of the day.
    await interaction.deferReply();
    await interaction.editReply({
      embeds: [await buildReportEmbed(interaction.guildId, interaction.guild.name)],
    });
  },
};
