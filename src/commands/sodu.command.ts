import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const soduCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sodu')
    .setDescription('Xem số dư và thống kê của bạn (hoặc của người khác)')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người muốn xem').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi') ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: 'Bot không có ví đâu!', flags: MessageFlags.Ephemeral });
      return;
    }
    const profile = economy.getProfile(target.id);
    const net = profile.totalWon - profile.totalLost;
    const netText = net >= 0 ? `+${formatCoins(net)}` : `-${formatCoins(-net)}`;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle(`💰 Ví của ${target.displayName}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Số dư', value: formatCoins(profile.balance), inline: true },
            { name: 'Hạng', value: `#${profile.rank}`, inline: true },
            { name: 'Chuỗi điểm danh', value: `${profile.dailyStreak} ngày`, inline: true },
            { name: 'Số ván đã chơi', value: `${profile.gamesPlayed}`, inline: true },
            { name: 'Tổng thắng', value: formatCoins(profile.totalWon), inline: true },
            { name: 'Lời/lỗ', value: netText, inline: true },
          ),
      ],
    });
  },
};
