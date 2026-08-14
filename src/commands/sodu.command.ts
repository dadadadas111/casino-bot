import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buffs, economy, figurines } from '../context.js';
import { BUFFS } from '../services/buff.service.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const soduCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sodu')
    .setDescription('Xem số dư và thống kê của bạn (hoặc của người khác)')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người muốn xem').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi') ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: 'Bot không có ví đâu!', flags: MessageFlags.Ephemeral });
      return;
    }
    const profile = economy.getProfile(target.id);
    const net = profile.totalWon - profile.totalLost;
    const netText = net >= 0 ? `+${formatCoins(net)}` : `-${formatCoins(-net)}`;
    const spouse = economy.spouseOf(target.id);
    const figurine = figurines.get(target.id);
    const jailed = economy.jailedUntil(target.id);
    const hospitalized = economy.hospitalizedUntil(target.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle(`💰 Ví của ${target.displayName}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Ví', value: formatCoins(profile.balance), inline: true },
        { name: 'Két ngân hàng', value: formatCoins(economy.getBank(target.id)), inline: true },
        { name: 'Hạng', value: `#${profile.rank}`, inline: true },
        { name: 'Chuỗi điểm danh', value: `${profile.dailyStreak} ngày`, inline: true },
        { name: 'Số ván đã chơi', value: `${profile.gamesPlayed}`, inline: true },
        { name: 'Lời/lỗ', value: netText, inline: true },
        {
          name: 'Tình trạng',
          value: [
            spouse
              ? `💍 Đã kết hôn với <@${spouse}>`
              : figurine?.married
                ? `💍 Đã kết hôn với **${figurine.emoji} ${figurine.name}**`
                : '🕊️ Độc thân vui tính',
            jailed ? `🚔 Đang ngồi tù, ra tù <t:${Math.floor(jailed.getTime() / 1000)}:R>` : null,
            hospitalized
              ? `🏥 Đang nằm viện, xuất viện <t:${Math.floor(hospitalized.getTime() / 1000)}:R>`
              : null,
            ...buffs
              .activeList(target.id)
              .map(
                (b) =>
                  `${BUFFS[b.buff]?.emoji ?? '✨'} ${BUFFS[b.buff]?.name ?? b.buff} còn hiệu lực đến <t:${Math.floor(b.expiresAt.getTime() / 1000)}:R>`,
              ),
          ]
            .filter(Boolean)
            .join('\n'),
          inline: false,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
