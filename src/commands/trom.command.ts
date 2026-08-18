import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy, items } from '../context.js';
import { ROB_MIN_VICTIM_WALLET } from '../services/economy.service.js';
import { releaseRow } from '../interactions/downtime.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const tromCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('trom')
    .setDescription('Trộm xu trong ví người khác: 40% thành công, thất bại đi tù 5 phút')
    .addUserOption((o) => o.setName('nguoi').setDescription('Con mồi').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const thief = interaction.user;
    const victim = interaction.options.getUser('nguoi', true);

    if (victim.bot || victim.id === thief.id) {
      await interaction.reply({
        content: victim.bot ? 'Trộm của bot là trộm của nhà cái, đừng dại!' : 'Tự móc túi mình làm gì?',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // A shield on the victim eats the attempt before the dice roll.
    const cooldown = economy.robCooldownRemaining(thief.id);
    if (cooldown > 0) {
      await interaction.reply({
        content: `🕵️ Nghề trộm cần kiên nhẫn! Thử lại <t:${Math.floor((Date.now() + cooldown) / 1000)}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (economy.getBalance(victim.id) < ROB_MIN_VICTIM_WALLET) {
      await interaction.reply({
        content: `Ví của **${victim.displayName}** lép kẹp (dưới ${formatCoins(ROB_MIN_VICTIM_WALLET)}), trộm không bõ công.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (items.consume(victim.id, 'khien')) {
      // Spend the attempt but do NOT jail: the shield stopped the crime, it did not report it.
      economy.startRobCooldown(thief.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setDescription(
              `🛡️ **${thief.displayName}** mò vào túi **${victim.displayName}** nhưng bị khiên chống trộm chặn đứng! Khiên đã vỡ.\n-# Không bị bắt, nhưng lượt trộm giờ này coi như đã dùng.`,
            ),
        ],
      });
      return;
    }

    const outcome = economy.tryRob(thief.id, victim.id);
    if (outcome.result === 'success') {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setDescription(
              `🦹 **${thief.displayName}** móc túi **${victim.displayName}** thành công, cuỗm **${formatCoins(outcome.amount)}**!\n-# Gửi két đi (nút 🏦 Gửi két trong \`/vi\`), trong két trộm không đụng được.`,
            ),
        ],
        allowedMentions: { parse: [] },
      });
      return;
    }
    if (outcome.result === 'jailed') {
      const fee = economy.releaseFee(thief.id, 'jail');
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setDescription(
              `🚔 **${thief.displayName}** trộm hụt **${victim.displayName}** và bị tóm tại trận! Ngồi tù đến <t:${Math.floor(outcome.releaseAt.getTime() / 1000)}:R>.\n-# Muốn ra sớm thì nộp phạt ${formatCoins(fee)} ngay bên dưới.`,
            ),
        ],
        components: [releaseRow('jail', fee)],
      });
      return;
    }
    await interaction.reply({ content: 'Phi vụ đổ bể, thử lại sau.', flags: MessageFlags.Ephemeral });
  },
};
