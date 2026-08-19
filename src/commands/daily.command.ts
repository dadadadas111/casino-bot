import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { assets, economy } from '../context.js';
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
            (() => {
              const house = assets.best(interaction.user.id, 'nha');
              const lines = [`Bạn nhận được **${formatCoins(result.amount)}**`];
              if (result.houseBonus && house) {
                lines.push(
                  `-# Trong đó ${house.emoji} ${house.name} cộng thêm ${formatCoins(result.houseBonus)}.`,
                );
              }
              if (result.catFind) {
                lines.push(`🐱 Mèo tha về **${formatCoins(result.catFind)}** và thả xuống chân bạn.`);
              }
              lines.push(
                `Chuỗi điểm danh: **${result.streak} ngày** 🔥`,
                `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
              );
              if (!house) {
                lines.push('', '-# Có nhà thì điểm danh được nhiều hơn. Xem `/tuido` thẻ 🏠 Tài sản.');
              }
              return lines.join('\n');
            })(),
          ),
      ],
    });
  },
};
