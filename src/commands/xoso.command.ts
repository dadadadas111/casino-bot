import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { economy, lottery } from '../context.js';
import {
  type BuyError,
  DRAW_HOUR,
  MAX_TICKETS_PER_DAY,
  TICKET_PRICE,
} from '../services/lottery.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { refuseIfDown } from '../interactions/downtime.js';
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
    .setDescription(
      `Xổ số: vé ${TICKET_PRICE} xu chọn số 00-99, quay ${DRAW_HOUR}h mỗi tối, jackpot dồn`,
    )
    .addIntegerOption((o) =>
      o
        .setName('so')
        .setDescription('Số may mắn của bạn (0-99). Bỏ trống để xem jackpot và vé đang giữ')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(99),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.channelId) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // A number means "buy that ticket"; no number opens the jackpot board.
    const number = interaction.options.getInteger('so');
    if (number !== null) {
      await buyTicket(interaction, number);
      return;
    }

    const info = lottery.info(interaction.user.id);
    await interaction.reply({
      embeds: [infoEmbed(interaction.user.id, info)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(componentId('xs', 'buy'))
            .setLabel(`Mua vé · ${formatCoins(TICKET_PRICE)}`)
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Success),
        ),
      ],
    });
  },
};

function infoEmbed(userId: string, info: ReturnType<typeof lottery.info>): EmbedBuilder {
  const myText =
    info.myNumbers.length > 0
      ? info.myNumbers.map((n) => `\`${String(n).padStart(2, '0')}\``).join(' ')
      : 'Chưa có vé nào.';
  return new EmbedBuilder()
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
        `Mua nhanh: \`/xoso so:42\``,
      ].join('\n'),
    );
}

async function buyTicket(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  number: number,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.channelId) return;
  const result = lottery.buy(interaction.user.id, number, interaction.guildId, interaction.channelId);
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
}

export const lotteryComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (await refuseIfDown(interaction)) return;
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(componentId('xs', 'pick'))
        .setTitle('Mua vé xổ số')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('so')
              .setLabel('Số may mắn (0-99)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(2),
          ),
        ),
    );
  },

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const raw = interaction.fields.getTextInputValue('so').trim();
    const number = Number(raw);
    if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(number) || number < 0 || number > 99) {
      await interaction.reply({
        content: 'Số phải từ 0 đến 99 thôi nhé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await buyTicket(interaction, number);
  },
};
