import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { historyTable } from '../embeds/history-table.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const lichsuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lichsu')
    .setDescription('Xem lịch sử biến động số dư (chỉ mình bạn thấy kết quả)')
    .addIntegerOption((o) =>
      o
        .setName('soluong')
        .setDescription('Số giao dịch muốn xem (mặc định 10)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(20),
    )
    .addUserOption((o) =>
      o.setName('nguoi').setDescription('Xem lịch sử của người khác').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const limit = interaction.options.getInteger('soluong') ?? 10;
    const target = interaction.options.getUser('nguoi') ?? interaction.user;
    if (target.bot) {
      await interaction.reply({
        content: 'Bot không có ví đâu!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const { entries, total } = economy.getHistory(target.id, limit);

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`📜 Lịch sử giao dịch của ${target.displayName}`)
      .setDescription(
        [
          `Số dư hiện tại: **${formatCoins(economy.getBalance(target.id))}**`,
          historyTable(entries),
        ].join('\n'),
      )
      .setFooter({
        text:
          (total > entries.length
            ? `${entries.length} giao dịch gần nhất trong tổng ${total} · /lichsu soluong:20 để xem nhiều hơn`
            : `Toàn bộ ${total} giao dịch`) + ' · giờ VN',
      });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
