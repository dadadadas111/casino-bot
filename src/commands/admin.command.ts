import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

// Anti-inflation caps: admins juice the economy in small doses only.
// The set cap stays above what a single top-up exchange can produce so
// paying players are never capped below what they bought.
export const ADMIN_ADD_CAP = 10_000;
export const ADMIN_SET_CAP = 1_000_000;

export const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('casino-admin')
    .setDescription('Quản lý xu (chỉ dành cho admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc
        .setName('cong')
        .setDescription('Cộng xu cho người chơi')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('soxu').setDescription('Số xu').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('tru')
        .setDescription('Trừ xu của người chơi')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người bị trừ').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('soxu').setDescription('Số xu').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('dat')
        .setDescription('Đặt số dư của người chơi về một mức cụ thể')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người chơi').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('soxu').setDescription('Số dư mới').setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('resetcd')
        .setDescription('Reset cooldown cho người chơi (kể cả chính bạn)')
        .addUserOption((o) =>
          o.setName('nguoi').setDescription('Người được reset').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('loai')
            .setDescription('Loại cooldown muốn reset')
            .setRequired(true)
            .addChoices(
              { name: 'Tất cả', value: 'all' },
              { name: 'Điểm danh (/daily)', value: 'daily' },
              { name: 'Làm việc (/lamviec)', value: 'work' },
              { name: 'Triệu phú (/trieuphu)', value: 'trieuphu' },
            ),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // customIds and default permissions are client-forgeable; always re-check.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Lệnh này chỉ dành cho admin.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('nguoi', true);

    if (sub === 'resetcd') {
      const kind = interaction.options.getString('loai', true) as
        | 'daily'
        | 'work'
        | 'trieuphu'
        | 'all';
      economy.resetCooldown(target.id, kind);
      const kindLabel =
        kind === 'all'
          ? 'tất cả cooldown'
          : kind === 'daily'
            ? 'cooldown điểm danh (giữ nguyên chuỗi)'
            : kind === 'work'
              ? 'cooldown làm việc'
              : 'cooldown Triệu phú';
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setDescription(`🛠️ Đã reset ${kindLabel} cho **${target.displayName}**.`),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger('soxu', true);

    if ((sub === 'cong' || sub === 'tru') && amount > ADMIN_ADD_CAP) {
      await interaction.reply({
        content: `Tối đa ${formatCoins(ADMIN_ADD_CAP)} mỗi lần cộng/trừ, để kinh tế server không vỡ trận.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (sub === 'dat' && amount > ADMIN_SET_CAP) {
      await interaction.reply({
        content: `Số dư đặt tối đa là ${formatCoins(ADMIN_SET_CAP)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let action: string;
    if (sub === 'cong') {
      economy.credit(target.id, amount, 'admin_add');
      action = `Đã cộng **${formatCoins(amount)}** cho`;
    } else if (sub === 'tru') {
      economy.debit(target.id, amount, 'admin_sub');
      action = `Đã trừ **${formatCoins(amount)}** của`;
    } else {
      economy.setBalance(target.id, amount);
      action = `Đã đặt số dư **${formatCoins(amount)}** cho`;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setDescription(
            `🛠️ ${action} **${target.displayName}**. Số dư hiện tại: ${formatCoins(economy.getBalance(target.id))}`,
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
