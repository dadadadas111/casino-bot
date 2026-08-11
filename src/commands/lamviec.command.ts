import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

const JOBS = [
  'chia bài ở sòng',
  'lau máy xèng bóng loáng',
  'trông xe cho khách VIP',
  'bưng nước cho bàn tài xỉu',
  'đếm xu cho nhà cái',
  'canh cửa sòng bạc',
  'giao trà sữa xuyên đêm',
  'rửa chén thuê cho căng tin',
  'phát tờ rơi khuyến mãi',
  'sửa cái máy xèng bị kẹt',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const lamviecCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lamviec')
    .setDescription('Làm việc kiếm 100-300 xu, mỗi giờ một lần'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const result = economy.work(interaction.user.id);
    const retryUnix = Math.floor(result.retryAt.getTime() / 1000);

    if (!result.ok) {
      await interaction.reply({
        content: `😮‍💨 Bạn mới làm xong, nghỉ chút đã! Ca tiếp theo: <t:${retryUnix}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.win)
          .setTitle('🔨 Làm việc chăm chỉ!')
          .setDescription(
            [
              `**${interaction.user.displayName}** vừa ${pick(JOBS)} và nhận được **${formatCoins(result.amount)}**`,
              `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
              `Ca tiếp theo: <t:${retryUnix}:R>`,
            ].join('\n'),
          ),
      ],
    });
  },
};
