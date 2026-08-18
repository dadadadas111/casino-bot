import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { env } from '../config/env.js';
import { runBackup } from '../backup-scheduler.js';
import type { Command } from './types.js';

/** Manual trigger, mostly for checking the pipeline after a config change. */
export const backupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Sao lưu database ngay bây giờ (chỉ chủ bot)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!env.BOT_OWNER_ID || interaction.user.id !== env.BOT_OWNER_ID) {
      await interaction.reply({
        content: 'Lệnh này chỉ chủ bot dùng được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await runBackup(interaction.client, `thủ công bởi ${interaction.user.tag}`);
    await interaction.editReply({ content: `💾 ${result}` });
  },
};
