import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy, lottery } from '../context.js';
import {
  type BuyError,
  DRAW_HOUR,
  MAX_TICKETS_PER_DAY,
  TICKET_PRICE,
} from '../services/lottery.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export function drawTimeUnix(drawDay: string): number {
  return Math.floor(Date.parse(`${drawDay}T${DRAW_HOUR}:00:00+07:00`) / 1000);
}

export function buyErrorText(error: BuyError, userId: string): string {
  switch (error) {
    case 'invalid_number':
      return 'Chọn số từ 0 đến 99 thôi!';
    case 'max_tickets':
      return `Tối đa ${MAX_TICKETS_PER_DAY} vé mỗi kỳ, mai mua tiếp nhé!`;
    case 'insufficient':
      return `Không đủ xu! Vé giá ${formatCoins(TICKET_PRICE)}, số dư của bạn: ${formatCoins(economy.getBalance(userId))}`;
  }
}

export const xosoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('xoso')
    .setDescription(`Xổ số: vé ${TICKET_PRICE} xu chọn số 00-99, quay ${DRAW_HOUR}h mỗi tối, jackpot dồn`)
    .addSubcommand((sc) =>
      sc
        .setName('mua')
        .setDescription(`Mua 1 vé (${TICKET_PRICE} xu, tối đa ${MAX_TICKETS_PER_DAY} vé/kỳ)`)
        .addIntegerOption((o) =>
          o
            .setName('so')
            .setDescription('Số may mắn của bạn (0-99)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99),
        ),
    )
    .addSubcommand((sc) =>
      sc.setName('info').setDescription('Xem jackpot hiện tại, vé của bạn và giờ quay'),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.channelId) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'mua') {
      const number = interaction.options.getInteger('so', true);
      const result = lottery.buy(
        interaction.user.id,
        number,
        interaction.guildId,
        interaction.channelId,
      );
      if (!result.ok) {
        await interaction.reply({
          content: buyErrorText(result.error!, interaction.user.id),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setDescription(
              [
                `🎫 **${interaction.user.displayName}** vừa mua vé số **${String(number).padStart(2, '0')}** (vé thứ ${result.myTickets}/${MAX_TICKETS_PER_DAY})`,
                `💰 Jackpot hiện tại: **${formatCoins(result.jackpot!)}** · Quay số <t:${drawTimeUnix(result.drawDay!)}:R>`,
              ].join('\n'),
            ),
        ],
      });
      return;
    }

    // info
    const info = lottery.info(interaction.user.id);
    const myText =
      info.myNumbers.length > 0
        ? info.myNumbers.map((n) => `\`${String(n).padStart(2, '0')}\``).join(' ')
        : 'Chưa có vé nào. Mua bằng `/xoso mua so:<0-99>`';
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🎱 Xổ số hằng ngày')
          .setDescription(
            [
              `💰 Jackpot: **${formatCoins(info.jackpot)}**`,
              `⏰ Quay số kỳ này: <t:${drawTimeUnix(info.drawDay)}:R> (${DRAW_HOUR}h giờ VN)`,
              `🎫 Tổng vé kỳ này: ${info.totalTickets}`,
              `Vé của bạn: ${myText}`,
              '',
              `Vé ${formatCoins(TICKET_PRICE)}, trúng số chia cả jackpot, không ai trúng thì hũ dồn sang mai!`,
            ].join('\n'),
          ),
      ],
    });
  },
};
