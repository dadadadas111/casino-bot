import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import type { HistoryEntry } from '../services/economy.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

const GAME_LABELS: Record<string, string> = {
  blackjack: 'Blackjack',
  blackjack_double: 'Blackjack (gấp đôi)',
  taixiu: 'Tài xỉu',
  baucua: 'Bầu cua',
  coinflip: 'Tung xu',
  slots: 'Xèng',
  keo: 'Kèo 1v1',
};

const TYPE_ICONS: Record<string, string> = {
  welcome: '🎁',
  daily: '📅',
  bet: '🎲',
  payout: '🏆',
  transfer_out: '💸',
  transfer_in: '💰',
  admin_add: '🛠️',
  admin_sub: '🛠️',
  admin_set: '🛠️',
  refund: '↩️',
};

function describe(entry: HistoryEntry): string {
  const game = GAME_LABELS[entry.meta ?? ''] ?? entry.meta ?? '';
  switch (entry.type) {
    case 'welcome':
      return 'Quà tân thủ';
    case 'daily':
      return 'Điểm danh';
    case 'bet':
      return `Cược ${game}`;
    case 'payout':
      return `Thưởng ${game}`;
    case 'transfer_out':
      return `Chuyển cho <@${entry.meta}>`;
    case 'transfer_in':
      return `Nhận từ <@${entry.meta}>`;
    case 'admin_add':
      return 'Admin cộng';
    case 'admin_sub':
      return 'Admin trừ';
    case 'admin_set':
      return 'Admin đặt số dư';
    case 'refund':
      return `Hoàn cược ${game}`;
    default:
      return entry.type;
  }
}

/**
 * Keep every line rhythmically identical so the list reads as columns:
 * icon, signed amount, resulting balance first (short, near-equal width),
 * then the variable-length label, then the timestamp at the end.
 */
function formatLine(entry: HistoryEntry): string {
  const sign = entry.amount >= 0 ? '+' : '';
  const unix = Math.floor(Date.parse(`${entry.createdAt.replace(' ', 'T')}Z`) / 1000);
  const icon = TYPE_ICONS[entry.type] ?? '💱';
  return `${icon} **${sign}${entry.amount.toLocaleString('vi-VN')}** → ${entry.balanceAfter.toLocaleString('vi-VN')} · ${describe(entry)} · <t:${unix}:R>`;
}

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
          '',
          ...entries.map(formatLine),
        ].join('\n'),
      )
      .setFooter({
        text:
          total > entries.length
            ? `${entries.length} giao dịch gần nhất trong tổng ${total} · /lichsu soluong:20 để xem nhiều hơn`
            : `Toàn bộ ${total} giao dịch`,
      });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
