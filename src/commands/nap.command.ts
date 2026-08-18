import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { topups } from '../context.js';
import { env } from '../config/env.js';
import { MAX_TOPUP, MIN_TOPUP } from '../services/topup.service.js';
import { topupEmbed } from '../embeds/topup.js';
import type { Command } from './types.js';

export const napCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nap')
    .setDescription('Nạp tiền vào ví 💵 bằng chuyển khoản ngân hàng (quét QR là xong)')
    .addIntegerOption((o) =>
      o
        .setName('sotien')
        .setDescription(
          `Số tiền VND muốn nạp (${MIN_TOPUP.toLocaleString('vi-VN')} - ${MAX_TOPUP.toLocaleString('vi-VN')})`,
        )
        .setRequired(true)
        .setMinValue(MIN_TOPUP)
        .setMaxValue(MAX_TOPUP),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!env.SEPAY_ACCOUNT) {
      await interaction.reply({
        content: 'Tính năng nạp tiền chưa được cấu hình. Liên hệ chủ bot nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const amount = interaction.options.getInteger('sotien', true);
    const request = topups.createRequest(
      interaction.user.id,
      amount,
      interaction.inGuild() ? interaction.guildId : null,
      interaction.channelId,
    );
    await interaction.reply({
      embeds: [topupEmbed(amount, request.code)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
