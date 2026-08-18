import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { env } from '../config/env.js';
import { JAIL_DURATION_MS } from '../services/economy.service.js';
import {
  ADMIN_ADD_CAP as ADD_CAP,
  ADMIN_SET_CAP as SET_CAP,
  isCheatBusted,
} from '../services/enforcement.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export { ADMIN_ADD_CAP, ADMIN_SET_CAP } from '../services/enforcement.service.js';

export const adminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('casino-admin')
    .setDescription('Quản lý xu (chỉ admin, coi chừng cảnh sát)')
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
    // The economy is shared across every server, so minting coins cannot be
    // delegated to whoever happens to be admin of some guild the bot joined.
    if (!env.BOT_OWNER_ID || interaction.user.id !== env.BOT_OWNER_ID) {
      await interaction.reply({
        content:
          'Xu dùng chung cho mọi server nên chỉ chủ bot mới chỉnh được số dư. Admin server không có quyền này.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('nguoi', true);
    const amount = interaction.options.getInteger('soxu', true);

    if ((sub === 'cong' || sub === 'tru') && amount > ADD_CAP) {
      await interaction.reply({
        content: `Tối đa ${formatCoins(ADD_CAP)} mỗi lần cộng/trừ, để kinh tế server không vỡ trận.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (sub === 'dat' && amount > SET_CAP) {
      await interaction.reply({
        content: `Số dư đặt tối đa là ${formatCoins(SET_CAP)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // The raid happens before any money moves, so a bust changes nothing.
    if (isCheatBusted()) {
      const release = economy.jail(interaction.user.id, JAIL_DURATION_MS);
      const attempt =
        sub === 'cong'
          ? `bơm ${formatCoins(amount)} cho`
          : sub === 'tru'
            ? `rút trộm ${formatCoins(amount)} của`
            : `sửa sổ sách thành ${formatCoins(amount)} cho`;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setTitle('🚨 CẢNH SÁT ĐỘT KÍCH!')
            .setDescription(
              [
                `**${interaction.user.displayName}** đang lén ${attempt} **${target.displayName}** thì bị tóm tại trận!`,
                '',
                '❌ Giao dịch đã bị hủy, không một xu nào được chuyển.',
                `🚔 Bị áp giải về đồn, ra tù <t:${Math.floor(release.getTime() / 1000)}:R>. Nộp phạt bằng \`/nopphat\` nếu muốn ra sớm.`,
                '',
                '-# Làm admin không có nghĩa là đứng trên pháp luật.',
              ].join('\n'),
            ),
        ],
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
