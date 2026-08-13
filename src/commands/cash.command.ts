import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { cash } from '../context.js';
import { env } from '../config/env.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ 💵`;
}

export const cashCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cash')
    .setDescription('Tiền nạp (VND): dùng reset cooldown Triệu phú và đồ premium')
    .addSubcommand((sc) => sc.setName('xem').setDescription('Xem số dư tiền nạp của bạn'))
    .addSubcommand((sc) =>
      sc
        .setName('nap')
        .setDescription('Cộng tiền nạp cho người chơi (chỉ chủ bot)')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('sotien').setDescription('Số tiền VND').setRequired(true).setMinValue(1_000),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.options.getSubcommand() === 'nap') {
      // Real money on the line: only the bot owner may credit, never guild admins.
      if (!env.BOT_OWNER_ID || interaction.user.id !== env.BOT_OWNER_ID) {
        await interaction.reply({
          content: 'Chỉ chủ bot mới cộng được tiền nạp.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const target = interaction.options.getUser('nguoi', true);
      const amount = interaction.options.getInteger('sotien', true);
      cash.credit(target.id, amount, `manual:${interaction.user.id}`);
      await interaction.reply({
        content: `💵 Đã cộng ${formatVnd(amount)} cho **${target.displayName}**. Số dư nạp mới: ${formatVnd(cash.get(target.id))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('💵 Tiền nạp')
          .setDescription(
            [
              `Số dư của bạn: **${formatVnd(cash.get(interaction.user.id))}**`,
              '',
              'Dùng để: reset cooldown Ai Là Triệu Phú (2.000đ/lần), và các món premium sắp ra mắt.',
              'Cách nạp: chuyển khoản cho chủ bot rồi được cộng tay. Nạp tự động qua cổng thanh toán đang được chuẩn bị.',
              'Lưu ý: tiền nạp chỉ dùng trong bot, không quy đổi ngược ra tiền thật, không mua được xu.',
            ].join('\n'),
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
