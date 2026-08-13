import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export const doitenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('doiten')
    .setDescription('Đổi tên hiển thị của bot trong server này (cần quyền Quản lý biệt danh)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addStringOption((o) =>
      o
        .setName('ten')
        .setDescription('Tên mới (bỏ trống để trả về tên gốc)')
        .setRequired(false)
        .setMaxLength(32),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Default permissions are server-editable; re-check at runtime.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý biệt danh để đổi tên bot.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const name = interaction.options.getString('ten');
    const me = interaction.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ChangeNickname)) {
      await interaction.reply({
        content: 'Bot chưa có quyền **Change Nickname** trong server này, nhờ admin cấp giúp nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await me.setNickname(name, `Đổi bởi ${interaction.user.tag}`);
    } catch (error) {
      console.error('[doiten] setNickname failed:', error);
      await interaction.reply({
        content: 'Đổi tên thất bại, có thể do thiếu quyền hoặc tên không hợp lệ.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setDescription(
            name
              ? `✏️ Từ giờ cứ gọi tôi là **${name}** trong server này nhé!`
              : '✏️ Đã trả lại tên gốc cho bot.',
          ),
      ],
    });
  },
};
