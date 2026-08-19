import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buffs, gifs, loans } from '../context.js';
import { DUN_COOLDOWN_MS, amountDue } from '../services/loan.service.js';
import { tryUse } from '../services/cooldown.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

/**
 * Pure shaming: not a single coin moves. The debtor picks up a short buff
 * that pays a little extra at work, because being hounded means overtime.
 */
const TAUNTS: string[] = [
  '📣 **{a}** gõ cửa nhà **{b}**: "Anh ơi, hôm nay là hạn rồi đấy ạ."',
  '📣 **{a}** nhắn tin nhắc **{b}** trả nợ, kèm ba icon mặt cười lạnh sống lưng.',
  '📣 **{a}** đứng trước cửa **{b}** hắng giọng: "Có nhà không đấy?"',
];

const TAUNTS_LOUD: string[] = [
  '📢 **{a}** mang loa kéo tới nhà **{b}** mở hết cỡ: "TRẢ NỢ ĐI EM ƠI!"',
  '📢 **{a}** thuê hẳn đội kèn trống diễu qua nhà **{b}** ba vòng.',
  '📢 **{a}** dán tờ rơi khắp xóm, ảnh **{b}** to bằng cái mâm.',
  '📢 **{a}** gọi điện cho cả họ hàng nhà **{b}**, kể tội từ đời ông nội.',
];

const TAUNTS_SAVAGE: string[] = [
  '🚨 **{a}** dựng rạp trước cửa nhà **{b}**, thuê MC đọc số nợ suốt buổi sáng.',
  '🚨 **{a}** treo băng rôn đỏ chót giữa chợ: "**{b}** VAY TIỀN KHÔNG TRẢ".',
  '🚨 **{a}** đăng ảnh **{b}** lên bảng tin khu phố, mục "gương mặt cần tìm".',
  '🚨 Đội đòi nợ của **{a}** ngồi lì trong nhà **{b}** từ sáng, gọi thêm cơm hộp.',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Louder each time the same debt gets chased. */
function tauntFor(dunned: number): { line: string; gif: string; color: number } {
  if (dunned >= 10) return { line: pick(TAUNTS_SAVAGE), gif: 'punch', color: COLORS.lose };
  if (dunned >= 4) return { line: pick(TAUNTS_LOUD), gif: 'poke', color: COLORS.gold };
  return { line: pick(TAUNTS), gif: 'stare', color: COLORS.info };
}

export const doinoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('doino')
    .setDescription('Đi đòi nợ một con nợ (không lấy được xu, nhưng nhục thì có)')
    .addUserOption((o) => o.setName('nguoi').setDescription('Con nợ').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi', true);
    const me = interaction.user;

    if (target.bot || target.id === me.id) {
      await interaction.reply({
        content: target.bot
          ? 'Bot không vay của ai bao giờ.'
          : 'Tự đòi nợ chính mình thì đúng là túng quẫn thật.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const loan = loans.open(target.id);
    if (!loan) {
      await interaction.reply({
        content: `**${target.displayName}** đang sạch nợ, đòi cái gì mà đòi!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // One collector cannot hound the same debtor on repeat.
    const remaining = tryUse(me.id, `doino:${target.id}`, DUN_COOLDOWN_MS);
    if (remaining > 0) {
      await interaction.reply({
        content: `Vừa đòi xong mà, để người ta thở đã. Thử lại sau ${Math.ceil(remaining / 60_000)} phút.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    const dunned = loans.recordDun(loan.id);
    buffs.activate(target.id, 'dino');
    const taunt = tauntFor(dunned);
    const gif = await gifs.get(taunt.gif);

    const owed = amountDue(loan.principal, loan.dueAt, new Date());
    const overdue = loan.dueAt.getTime() < Date.now();
    const embed = new EmbedBuilder()
      .setColor(taunt.color)
      .setTitle('🧾 ĐÒI NỢ')
      .setDescription(
        [
          taunt.line.replaceAll('{a}', me.displayName).replaceAll('{b}', target.displayName),
          '',
          `💰 Số nợ: **${formatCoins(owed)}**`,
          overdue
            ? `🔥 **ĐÃ QUÁ HẠN** từ <t:${Math.floor(loan.dueAt.getTime() / 1000)}:R>, lãi phạt đang chạy.`
            : `⏰ Hạn trả: <t:${Math.floor(loan.dueAt.getTime() / 1000)}:R>`,
          `😰 Bị đòi lần thứ **${dunned}**`,
          '',
          '-# Không mất xu nào, chỉ mất mặt. Con nợ dính trạng thái Bị dí nợ 10 phút, phải cày thêm ca nên lương tạm thời +10%.',
        ].join('\n'),
      );
    if (gif) embed.setImage(gif);

    await interaction.editReply({
      content: `<@${target.id}>`,
      embeds: [embed],
      allowedMentions: { users: [target.id] },
    });
  },
};
