import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { assets, economy } from '../context.js';
import { WORK_COOLDOWN_MS } from '../services/economy.service.js';
import { JOB_RANKS, rankFor, shiftsToNext } from '../services/job.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { announce } from '../interactions/announce.js';
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
    .setDescription('Đi làm kiếm xu. Làm càng nhiều ca càng lên chức, lương càng cao'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const result = economy.work(interaction.user.id);
    const retryUnix = Math.floor(result.retryAt.getTime() / 1000);

    if (!result.ok) {
      const vehicle = assets.best(interaction.user.id, 'xe');
      await interaction.reply({
        content: [
          `😮‍💨 Bạn mới làm xong, nghỉ chút đã! Ca tiếp theo: <t:${retryUnix}:R>.`,
          vehicle
            ? `-# ${vehicle.emoji} ${vehicle.name} đang rút ngắn thời gian chờ cho bạn.`
            : `-# Mua xe trong \`/tuido\` để đi làm nhanh hơn ${WORK_COOLDOWN_MS / 60_000} phút một ca.`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rank = rankFor(result.shifts ?? 1);
    const toNext = shiftsToNext(result.shifts ?? 1);
    const lines = [
      `**${interaction.user.displayName}** vừa ${pick(JOBS)} với tư cách ${rank.emoji} **${rank.name}**`,
    ];
    // Only show the deduction when there is one: most players never see it.
    if (result.tax && result.tax > 0) {
      lines.push(
        `💼 Lương: ${formatCoins(result.gross ?? 0)}`,
        `💸 Thuế thu nhập: **-${formatCoins(result.tax)}**`,
        `👛 Thực nhận: **${formatCoins(result.amount)}**`,
      );
    } else {
      lines.push(`👛 Nhận được **${formatCoins(result.amount)}**`);
    }
    if (result.hounded) lines.push('😰 Đang bị dí nợ nên phải cày thêm ca, lương +10%');
    lines.push(
      `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
      `Ca tiếp theo: <t:${retryUnix}:R>${assets.best(interaction.user.id, 'xe') ? ` ${assets.best(interaction.user.id, 'xe')!.emoji}` : ''}`,
    );
    if (toNext > 0) lines.push(`-# Còn ${toNext} ca nữa là lên chức.`);
    if (result.bracket && result.bracket >= 0.25) {
      lines.push(
        `-# Thu nhập 24h của bạn đang ở bậc thuế ${Math.round(result.bracket * 100)}%. Nghỉ tay một lúc cho nó hạ xuống.`,
      );
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.win)
          .setTitle('🔨 Làm việc chăm chỉ!')
          .setDescription(lines.join('\n')),
      ],
    });

    if (result.promoted) {
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setTitle('🎉 THĂNG CHỨC!')
            .setDescription(
              [
                `Sau **${result.shifts}** ca cày cuốc, <@${interaction.user.id}> chính thức lên chức ${rank.emoji} **${rank.name}**!`,
                `Lương mỗi ca giờ là **${rank.min.toLocaleString('vi-VN')} - ${rank.max.toLocaleString('vi-VN')} xu**.`,
                rank.key === JOB_RANKS[JOB_RANKS.length - 1].key
                  ? 'Đỉnh cao sự nghiệp, không còn chức nào cao hơn nữa. 🏆'
                  : `Cố lên, còn ${shiftsToNext(result.shifts ?? 0)} ca nữa là lên tiếp.`,
              ].join('\n'),
            ),
        ],
        allowedMentions: { users: [interaction.user.id] },
      });
    }
  },
};
