import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy } from '../context.js';
import {
  BAU_CUA_SYMBOLS,
  type BauCuaSymbol,
  bauCuaPayout,
  rollBauCua,
} from '../services/minigames.service.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import { placeBetOrReply, resultLine } from './bet-helpers.js';
import type { Command } from './types.js';

export const baucuaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('baucua')
    .setDescription('Bầu cua tôm cá: lắc 3 xúc xắc, mỗi mặt trúng ăn 1:1')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    )
    .addStringOption((o) =>
      o
        .setName('chon')
        .setDescription('Linh vật muốn đặt')
        .setRequired(true)
        .addChoices(
          ...Object.entries(BAU_CUA_SYMBOLS).map(([value, s]) => ({
            name: `${s.emoji} ${s.label}`,
            value,
          })),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('cuoc', true);
    const choice = interaction.options.getString('chon', true) as BauCuaSymbol;
    if (!(await placeBetOrReply(interaction, bet, 'baucua'))) return;

    const chosen = BAU_CUA_SYMBOLS[choice];
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.playing)
          .setTitle('🦀 Bầu Cua')
          .setDescription(
            `**${interaction.user.displayName}** đặt **${formatCoins(bet)}** cửa **${chosen.emoji} ${chosen.label}**\n\n🎲 Đang lắc...`,
          ),
      ],
    });
    await sleep(1500);

    const result = rollBauCua(choice);
    const payout = bauCuaPayout(result, bet);
    economy.settleGame(interaction.user.id, bet, payout, 'baucua');

    const diceText = result.dice
      .map((d) => `${BAU_CUA_SYMBOLS[d].emoji} ${BAU_CUA_SYMBOLS[d].label}`)
      .join('  |  ');
    const hitText =
      result.matches > 0
        ? `Trúng **${result.matches}** mặt ${chosen.emoji}, ăn ${result.matches}:1!`
        : `Không trúng mặt ${chosen.emoji} nào.`;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(payout > 0 ? COLORS.win : COLORS.lose)
          .setTitle('🦀 Bầu Cua: Kết quả')
          .setDescription(
            [
              `Kết quả: ${diceText}`,
              `Bạn đặt: **${chosen.emoji} ${chosen.label}** với ${formatCoins(bet)}`,
              hitText,
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
