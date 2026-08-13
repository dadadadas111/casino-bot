import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { luck } from '../context.js';
import { env } from '../config/env.js';
import type { Command } from './types.js';

/**
 * Owner-only knob for the hidden luck factor. Guild admins must not reach
 * this: rigged odds are the owner's call alone.
 */
export const luckCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('luck')
    .setDescription('Chỉnh vận may ẩn của người chơi (chỉ chủ bot)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc
        .setName('dat')
        .setDescription('Đặt mức vận may (0 = tắt, 100 = luôn được chơi lại khi thua)')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người chơi').setRequired(true))
        .addIntegerOption((o) =>
          o
            .setName('muc')
            .setDescription('Từ 0 đến 100')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sc) => sc.setName('xem').setDescription('Xem ai đang được ưu ái')),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!env.BOT_OWNER_ID || interaction.user.id !== env.BOT_OWNER_ID) {
      await interaction.reply({
        content: 'Lệnh này chỉ chủ bot dùng được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'xem') {
      const rows = luck.list();
      await interaction.reply({
        content:
          rows.length > 0
            ? ['🍀 Danh sách được ưu ái:', ...rows.map((r) => `<@${r.userId}> : ${Math.round(r.factor * 100)}%`)].join('\n')
            : 'Chưa ưu ái ai cả, sòng bạc đang sạch.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const target = interaction.options.getUser('nguoi', true);
    const level = interaction.options.getInteger('muc', true);
    luck.set(target.id, level / 100);
    await interaction.reply({
      content:
        level > 0
          ? `🍀 **${target.displayName}** giờ có ${level}% cơ hội được chơi lại mỗi khi thua ở tài xỉu, bầu cua, tung xu, xèng và đua ngựa.\n-# Kèo 1v1, cò quay và xổ số không đụng tới, để không móc túi người khác.`
          : `✅ Đã gỡ vận may của **${target.displayName}**, chơi công bằng như mọi người.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
