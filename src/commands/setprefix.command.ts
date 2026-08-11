import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { prefixes } from '../context.js';
import { isValidPrefix } from '../services/prefix.service.js';
import { env } from '../config/env.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export const setprefixCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('setprefix')
    .setDescription('Đổi prefix lệnh nhắn tin của bot trong server này (mặc định !)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName('prefix')
        .setDescription('Prefix mới (1-5 ký tự, không khoảng trắng, ví dụ: ! ? $ c!)')
        .setRequired(true)
        .setMaxLength(5),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Permissions are client-forgeable; always re-check.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để đổi prefix.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const prefix = interaction.options.getString('prefix', true).trim();
    if (!isValidPrefix(prefix)) {
      await interaction.reply({
        content: 'Prefix không hợp lệ! Cần 1-5 ký tự, không khoảng trắng, không bắt đầu bằng `/`, không chứa `@` hoặc `#`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    prefixes.set(interaction.guildId, prefix);

    const note =
      env.ENABLE_PREFIX_COMMANDS === 'true'
        ? `Thử ngay: \`${prefix}sodu\`, \`${prefix}tx 100 tai\`, \`${prefix}slots 50\``
        : 'Lưu ý: tính năng lệnh nhắn tin đang tắt trên bot, prefix sẽ có hiệu lực khi tính năng được bật.';

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setDescription(`✅ Prefix của server này giờ là **\`${prefix}\`**\n${note}`),
      ],
    });
  },
};
