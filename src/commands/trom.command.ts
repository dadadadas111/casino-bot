import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy, items } from '../context.js';
import { BAIL_BASE_COST, ROB_MIN_VICTIM_WALLET } from '../services/economy.service.js';
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
      economy.tryRob(thief.id, victim.id, new Date(), 1); // burn the attempt, guaranteed no-steal
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setDescription(
              `🛡️ **${thief.displayName}** mò vào túi **${victim.displayName}** nhưng bị khiên chống trộm chặn đứng! Khiên đã vỡ.`,
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
              `🦹 **${thief.displayName}** móc túi **${victim.displayName}** thành công, cuỗm **${formatCoins(outcome.amount)}**!\n-# Gửi két đi (\`/bank gui\`), trong két trộm không đụng được.`,
            ),
        ],
        allowedMentions: { parse: [] },
      });
      return;
    }
    if (outcome.result === 'jailed') {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setDescription(
              `🚔 **${thief.displayName}** trộm hụt **${victim.displayName}** và bị tóm tại trận! Ngồi tù đến <t:${Math.floor(outcome.releaseAt.getTime() / 1000)}:R>.\n-# Nộp phạt ${formatCoins(economy.releaseFee(thief.id, 'jail'))} bằng \`/nopphat\` để ra sớm.`,
            ),
        ],
      });
      return;
    }
    await interaction.reply({ content: 'Phi vụ đổ bể, thử lại sau.', flags: MessageFlags.Ephemeral });
  },
};

export const nopphatCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nopphat')
    .setDescription(
      `Nộp phạt để ra tù ngay (${BAIL_BASE_COST.toLocaleString('vi-VN')} xu, tái phạm trong ngày thì nhân lên)`,
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const fee = economy.releaseFee(interaction.user.id, 'jail');
    const result = economy.bail(interaction.user.id);
    if (result === 'not_jailed') {
      await interaction.reply({
        content: 'Bạn có ở tù đâu mà nộp phạt?',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (result === 'poor') {
      await interaction.reply({
        content: `Không đủ ${formatCoins(fee)} để nộp phạt. Ngồi bóc lịch tiếp thôi!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const times = economy.offenseCount(interaction.user.id, 'jail');
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.win)
          .setDescription(
            `🔓 **${interaction.user.displayName}** đã nộp phạt ${formatCoins(fee)} và được thả tự do.${times > 1 ? ` Lần thứ ${times} trong ngày rồi đấy, lần sau phạt nặng hơn!` : ' Hoàn lương nhé!'}`,
          ),
      ],
    });
  },
};
