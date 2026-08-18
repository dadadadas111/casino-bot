import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy, reports } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export const topCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Bảng xếp hạng đại gia giàu nhất sòng bạc'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Scoped to this server: a global board would list strangers from guilds
    // the viewer has never seen.
    const rows = interaction.inGuild()
      ? reports.topUsers(interaction.guildId, 10)
      : economy.topByBalance(10);
    if (rows.length === 0) {
      await interaction.reply({ content: 'Chưa có ai chơi cả. Hãy là người đầu tiên!' });
      return;
    }

    const lines = rows.map((row, i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      return `${medal} <@${row.userId}> : ${formatCoins(row.balance)}`;
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🏆 Bảng xếp hạng sòng bạc')
          .setFooter({ text: 'Chỉ tính người chơi trong server này' })
          .setDescription(lines.join('\n')),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
