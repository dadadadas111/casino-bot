import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { reports } from '../context.js';
import { buildReportEmbed } from '../report-scheduler.js';
import type { Command } from './types.js';

export const bantinCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('bantin')
    .setDescription('Bản tin sòng bạc hằng ngày: top 10, thống kê 24h, jackpot')
    .addSubcommand((sc) =>
      sc.setName('xem').setDescription('Xem bản tin ngay bây giờ'),
    )
    .addSubcommand((sc) =>
      sc
        .setName('config')
        .setDescription('Cấu hình bản tin tự động (cần quyền Quản lý máy chủ)')
        .addStringOption((o) =>
          o
            .setName('trangthai')
            .setDescription('Bật/tắt bản tin tự động hằng ngày')
            .setRequired(false)
            .addChoices({ name: 'Bật', value: 'on' }, { name: 'Tắt', value: 'off' }),
        )
        .addIntegerOption((o) =>
          o
            .setName('gio')
            .setDescription('Giờ đăng bản tin (0-23, giờ VN, mặc định 10)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(23),
        )
        .addChannelOption((o) =>
          o
            .setName('kenh')
            .setDescription('Kênh cố định để đăng bản tin')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption((o) =>
          o
            .setName('kenh_tu_dong')
            .setDescription('true = bỏ kênh cố định, tự chọn kênh nhộn nhịp nhất')
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName('tag_everyone')
            .setDescription('Có tag @everyone khi đăng bản tin không')
            .setRequired(false),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: 'Lệnh này chỉ dùng trong server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'xem') {
      await interaction.reply({
        embeds: [buildReportEmbed(interaction.guildId, interaction.guild.name)],
      });
      return;
    }

    // config
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'Bạn cần quyền Quản lý máy chủ để cấu hình bản tin.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const trangthai = interaction.options.getString('trangthai');
    const gio = interaction.options.getInteger('gio');
    const kenh = interaction.options.getChannel('kenh');
    const kenhTuDong = interaction.options.getBoolean('kenh_tu_dong');
    const tagEveryone = interaction.options.getBoolean('tag_everyone');

    const patch: Parameters<typeof reports.updateConfig>[1] = {};
    if (trangthai !== null) patch.enabled = trangthai === 'on';
    if (gio !== null) patch.hour = gio;
    if (kenh) patch.channelId = kenh.id;
    if (kenhTuDong === true) patch.channelId = null;
    if (tagEveryone !== null) patch.tagEveryone = tagEveryone;

    const config = reports.updateConfig(interaction.guildId, patch);
    await interaction.reply({
      content: [
        '⚙️ Cấu hình bản tin của server này:',
        `- Trạng thái: ${config.enabled ? 'Bật ✅' : 'Tắt ❌'}`,
        `- Giờ đăng: ${config.hour}h (giờ VN)`,
        `- Kênh: ${config.channelId ? `<#${config.channelId}>` : 'tự động (kênh nhộn nhịp nhất)'}`,
        `- Tag @everyone: ${config.tagEveryone ? 'Có' : 'Không'}`,
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  },
};
