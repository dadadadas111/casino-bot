import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { reports } from '../context.js';
import { LATEST_PATCH } from '../data/patch-notes.js';
import { patchEmbed } from '../patch-announcer.js';
import type { Command } from './types.js';

export const patchnoteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('patchnote')
    .setDescription('Ghi chú cập nhật của bot')
    .addSubcommand((sc) => sc.setName('xem').setDescription('Xem bản cập nhật mới nhất'))
    .addSubcommand((sc) =>
      sc
        .setName('config')
        .setDescription('Cấu hình thông báo cập nhật (cần quyền Quản lý máy chủ)')
        .addStringOption((o) =>
          o
            .setName('trangthai')
            .setDescription('Bật/tắt tự thông báo khi bot cập nhật')
            .setRequired(false)
            .addChoices({ name: 'Bật', value: 'on' }, { name: 'Tắt', value: 'off' }),
        )
        .addChannelOption((o) =>
          o
            .setName('kenh')
            .setDescription('Kênh nhận thông báo cập nhật')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption((o) =>
          o
            .setName('kenh_tu_dong')
            .setDescription('true = bỏ kênh cố định, dùng chung kênh với bản tin')
            .setRequired(false),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'xem') {
      await interaction.reply({ embeds: [patchEmbed(LATEST_PATCH)] });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để cấu hình thông báo cập nhật.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const trangthai = interaction.options.getString('trangthai');
    const kenh = interaction.options.getChannel('kenh');
    const kenhTuDong = interaction.options.getBoolean('kenh_tu_dong');

    const patch: Parameters<typeof reports.updateConfig>[1] = {};
    if (trangthai !== null) patch.patchEnabled = trangthai === 'on';
    if (kenh) patch.patchChannelId = kenh.id;
    if (kenhTuDong === true) patch.patchChannelId = null;

    const config = reports.updateConfig(interaction.guildId, patch);
    await interaction.reply({
      content: [
        '⚙️ Thông báo cập nhật của server này:',
        `- Trạng thái: ${config.patchEnabled ? 'Bật ✅' : 'Tắt ❌'}`,
        `- Kênh: ${config.patchChannelId ? `<#${config.patchChannelId}>` : 'dùng chung kênh với bản tin'}`,
        `- Phiên bản đã thông báo: ${config.lastPatchVersion ?? 'chưa có'}`,
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  },
};
