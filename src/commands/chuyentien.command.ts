import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy, quests } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const chuyentienCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('chuyentien')
    .setDescription('Chuyển xu cho người chơi khác')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('soxu').setDescription('Số xu muốn chuyển').setRequired(true).setMinValue(1),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi', true);
    const amount = interaction.options.getInteger('soxu', true);

    if (target.bot) {
      await interaction.reply({
        content: 'Bot không cần xu đâu, cảm ơn bạn!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: 'Không thể tự chuyển xu cho chính mình.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (economy.transfer(interaction.user.id, target.id, amount)) {
      quests.record(interaction.user.id, ['transfer']);
    } else {
      await interaction.reply({
        content: `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(interaction.user.id))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('💸 Chuyển xu thành công')
          .setDescription(
            `**${interaction.user.displayName}** đã chuyển **${formatCoins(amount)}** cho **${target.displayName}**`,
          ),
      ],
    });
  },
};
