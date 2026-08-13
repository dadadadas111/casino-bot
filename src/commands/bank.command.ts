import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const bankCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Ngân hàng: tiền gửi vào két thì trộm không đụng được')
    .addSubcommand((sc) =>
      sc
        .setName('gui')
        .setDescription('Gửi xu từ ví vào két')
        .addIntegerOption((o) =>
          o.setName('soxu').setDescription('Số xu muốn gửi').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('rut')
        .setDescription('Rút xu từ két về ví')
        .addIntegerOption((o) =>
          o.setName('soxu').setDescription('Số xu muốn rút').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sc) => sc.setName('xem').setDescription('Xem số dư ví và két')),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'gui' || sub === 'rut') {
      const amount = interaction.options.getInteger('soxu', true);
      const ok =
        sub === 'gui' ? economy.depositBank(userId, amount) : economy.withdrawBank(userId, amount);
      if (!ok) {
        await interaction.reply({
          content:
            sub === 'gui'
              ? `Không đủ xu trong ví! Ví của bạn: ${formatCoins(economy.getBalance(userId))}`
              : `Không đủ xu trong két! Két của bạn: ${formatCoins(economy.getBank(userId))}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('🏦 Ngân hàng sòng bạc')
          .setDescription(
            [
              `👛 Ví (cược được, trộm được): **${formatCoins(economy.getBalance(userId))}**`,
              `🏦 Két (an toàn tuyệt đối): **${formatCoins(economy.getBank(userId))}**`,
              '',
              'Muốn cược thì phải rút về ví. Trộm chỉ móc được ví, không phá được két.',
            ].join('\n'),
          )
          .setFooter({ text: interaction.user.displayName }),
      ],
    });
  },
};
