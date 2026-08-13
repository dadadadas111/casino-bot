import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { economy, luck } from '../context.js';
import { SLOT_TRIPLE_PAYOUT, slotsPayout, spinSlots } from '../services/minigames.service.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import { placeBetOrReply, resultLine } from './bet-helpers.js';
import type { Command } from './types.js';

export const slotsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Quay máy xèng: 3 hình giống nhau trúng lớn (7️⃣7️⃣7️⃣ ăn x100)')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('cuoc', true);
    if (!(await placeBetOrReply(interaction, bet, 'slots'))) return;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.playing)
          .setTitle('🎰 Máy xèng')
          .setDescription(`**${interaction.user.displayName}** cược **${formatCoins(bet)}**\n\n🎰 | ❓ ❓ ❓ |`),
      ],
    });
    await sleep(1500);

    const result = luck.favor(
      interaction.user.id,
      () => spinSlots(),
      (r) => r.multiplier > 1,
    );
    const payout = slotsPayout(result, bet);
    economy.settleGame(interaction.user.id, bet, payout, 'slots');

    const reelText = `🎰 | ${result.reels.join(' ')} |`;
    const kindText =
      result.kind === 'triple'
        ? `✨ **JACKPOT ${result.reels[0]}${result.reels[0]}${result.reels[0]}!** Trúng x${result.multiplier}!`
        : result.kind === 'pair'
          ? '2 hình giống nhau: hoàn lại tiền cược.'
          : 'Không trúng hình nào.';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(payout > bet ? COLORS.gold : payout > 0 ? COLORS.push : COLORS.lose)
          .setTitle('🎰 Máy xèng: Kết quả')
          .setDescription(
            [
              reelText,
              kindText,
              '',
              resultLine(payout, bet),
              `Số dư mới: ${formatCoins(economy.getBalance(interaction.user.id))}`,
            ].join('\n'),
          )
          .setFooter({
            text: `Bảng thưởng x3 hình: ${Object.entries(SLOT_TRIPLE_PAYOUT)
              .map(([s, m]) => `${s}x${m}`)
              .join(' ')}`,
          }),
      ],
    });
  },
};
