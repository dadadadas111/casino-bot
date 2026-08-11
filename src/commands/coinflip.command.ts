import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy } from '../context.js';
import { coinflipPayout, flipCoin } from '../services/minigames.service.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import { placeBetOrReply, resultLine } from './bet-helpers.js';
import type { Command } from './types.js';

export const coinflipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Tung đồng xu: ngửa hay sấp, thắng ăn 1:1')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    )
    .addStringOption((o) =>
      o
        .setName('chon')
        .setDescription('Mặt đồng xu')
        .setRequired(true)
        .addChoices({ name: 'Ngửa', value: 'ngua' }, { name: 'Sấp', value: 'sap' }),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('cuoc', true);
    const choice = interaction.options.getString('chon', true) as 'ngua' | 'sap';
    if (!(await placeBetOrReply(interaction, bet, 'coinflip'))) return;

    const choiceLabel = choice === 'ngua' ? 'Ngửa' : 'Sấp';
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.playing)
          .setTitle('🪙 Tung đồng xu')
          .setDescription(
            `**${interaction.user.displayName}** đặt **${formatCoins(bet)}** cửa **${choiceLabel}**\n\n🪙 Đồng xu đang xoay...`,
          ),
      ],
    });
    await sleep(1200);

    const result = flipCoin();
    const payout = coinflipPayout(result, choice, bet);
    economy.settleGame(interaction.user.id, bet, payout, 'coinflip');

    const sideLabel = result.side === 'ngua' ? 'NGỬA 🌕' : 'SẤP 🌑';
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(payout > 0 ? COLORS.win : COLORS.lose)
          .setTitle(`🪙 Kết quả: ${sideLabel}`)
          .setDescription(
            [
              `Bạn đặt: **${choiceLabel}** với ${formatCoins(bet)}`,
              '',
              resultLine(payout, bet),
              `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
            ].join('\n'),
          )
          .setFooter({ text: interaction.user.displayName }),
      ],
    });
  },
};
