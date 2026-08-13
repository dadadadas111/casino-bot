import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy, luck } from '../context.js';
import { DICE_EMOJI, rollTaiXiu, taiXiuPayout } from '../services/minigames.service.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import { placeBetOrReply, resultLine } from './bet-helpers.js';
import type { Command } from './types.js';

export const taixiuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('taixiu')
    .setDescription('Lắc 3 xúc xắc: Tài (11-17) hay Xỉu (4-10)? Ra bão (3 số giống nhau) là thua')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    )
    .addStringOption((o) =>
      o
        .setName('chon')
        .setDescription('Cửa đặt cược')
        .setRequired(true)
        .addChoices({ name: 'Tài (11-17)', value: 'tai' }, { name: 'Xỉu (4-10)', value: 'xiu' }),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('cuoc', true);
    const choice = interaction.options.getString('chon', true) as 'tai' | 'xiu';
    if (!(await placeBetOrReply(interaction, bet, 'taixiu'))) return;

    const choiceLabel = choice === 'tai' ? 'Tài' : 'Xỉu';
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.playing)
          .setTitle('🎲 Tài Xỉu')
          .setDescription(
            `**${interaction.user.displayName}** đặt **${formatCoins(bet)}** cửa **${choiceLabel}**\n\n🎲 Đang lắc...`,
          ),
      ],
    });
    await sleep(1500);

    const result = luck.favor(
      interaction.user.id,
      () => rollTaiXiu(),
      (r) => taiXiuPayout(r, choice, bet) > 0,
    );
    const payout = taiXiuPayout(result, choice, bet);
    economy.settleGame(interaction.user.id, bet, payout, 'taixiu');

    const diceText = result.dice.map((d) => `${DICE_EMOJI[d]} ${d}`).join('  ');
    const outcomeLabel =
      result.outcome === 'bao' ? `BÃO (${result.total})` : result.outcome === 'tai' ? `TÀI (${result.total})` : `XỈU (${result.total})`;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(payout > 0 ? COLORS.win : COLORS.lose)
          .setTitle(`🎲 Tài Xỉu: ${outcomeLabel}`)
          .setDescription(
            [
              `Kết quả: ${diceText}`,
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
