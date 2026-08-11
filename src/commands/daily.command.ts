import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Điểm danh nhận xu miễn phí mỗi ngày (chuỗi liên tục thưởng thêm)'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const result = economy.claimDaily(interaction.user.id);

    if (!result.ok) {
      await interaction.reply({
        content: 'Hôm nay bạn đã điểm danh rồi. Quay lại vào ngày mai nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.win)
          .setTitle('📅 Điểm danh thành công!')
          .setDescription(
            [
              `Bạn nhận được **${formatCoins(result.amount)}**`,
              `Chuỗi điểm danh: **${result.streak} ngày** 🔥`,
              `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
              '',
              'Điểm danh liên tục mỗi ngày để nhận thưởng cao hơn (tối đa 1.000 xu/ngày)!',
            ].join('\n'),
          ),
      ],
    });
  },
};
