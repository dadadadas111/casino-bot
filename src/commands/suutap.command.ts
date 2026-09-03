import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { guildItems } from '../context.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

const RARITY = {
  legendary: { emoji: '🟡', weight: 15 },
  epic: { emoji: '🟣', weight: 7 },
  rare: { emoji: '🔵', weight: 3 },
  common: { emoji: '⚪', weight: 1 },
} as const;

const MEDALS = ['🥇', '🥈', '🥉'];

function rarityEmoji(r: string): string {
  return (RARITY as Record<string, { emoji: string }>)[r]?.emoji ?? '⚪';
}

function rarityWeight(r: string): number {
  return (RARITY as Record<string, { weight: number }>)[r]?.weight ?? 1;
}

export const suutapCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('suutap')
    .setDescription('Khoe bộ sưu tập item riêng của server và xem bảng xếp hạng sưu tầm')
    .addUserOption((o) => o.setName('nguoi').setDescription('Xem bộ sưu tập của người khác')),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const guildId = interaction.guildId;
    const target = interaction.options.getUser('nguoi') ?? interaction.user;

    const owned = guildItems.inventory(guildId, target.id);
    const totalSet = guildItems.list(guildId, { enabledOnly: true }).length;

    if (totalSet === 0) {
      await interaction.reply({
        content: 'Server này chưa có item sưu tầm nào. Admin tạo bằng `/quanly` nhé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const score = owned.reduce((s, o) => s + rarityWeight(o.item.rarity) * 1, 0);
    const collection = owned.length
      ? owned
          .slice()
          .sort((a, b) => rarityWeight(b.item.rarity) - rarityWeight(a.item.rarity))
          .map((o) => `${rarityEmoji(o.item.rarity)} ${o.item.emoji} **${o.item.name}**${o.qty > 1 ? ` x${o.qty}` : ''}`)
          .join('\n')
      : '_Chưa có item nào. Ghé `/cuahang` sắm đồ đi!_';

    const ranks = guildItems.collectors(guildId, 5);
    const board = ranks.length
      ? ranks
          .map((r, i) => `${MEDALS[i] ?? `#${i + 1}`} <@${r.userId}> · ${r.distinct} món · ${r.score} điểm`)
          .join('\n')
      : '_Chưa ai sưu tầm gì._';

    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle('🏅 Bộ sưu tập')
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        `Của <@${target.id}>\nSưu tầm: **${owned.length}/${totalSet}** món · điểm hiếm **${score}**`,
      )
      .addFields(
        { name: '🎁 Đang sở hữu', value: collection.slice(0, 1024) },
        { name: '🏆 Top sưu tầm server', value: board.slice(0, 1024) },
      )
      .setFooter({ text: 'Mua thêm ở /cuahang · điểm hiếm tính theo độ hiếm của món' });

    await interaction.reply({ embeds: [embed] });
  },
};
