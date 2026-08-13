import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config/env.js';
import { prefixes } from '../context.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn chơi và danh sách lệnh'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const prefixField =
      env.ENABLE_PREFIX_COMMANDS === 'true' && interaction.inGuild()
        ? [
            {
              name: '⚡ Lệnh nhắn nhanh',
              value: (() => {
                const p = prefixes.get(interaction.guildId);
                return `Prefix hiện tại: \`${p}\` (đổi bằng \`/setprefix\`)\n\`${p}tx 100 tai\` · \`${p}bc 100 cua\` · \`${p}cf 100 ngua\` · \`${p}slots 50\` · \`${p}sodu\` · \`${p}daily\` · \`${p}work\` · \`${p}top\``;
              })(),
            },
          ]
        : [];
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('🎰 Sòng Bạc Discord: Hướng dẫn')
          .setDescription('Mỗi người mới vào sòng được tặng **1.000 xu**. Chơi vui vẻ, đừng quên điểm danh mỗi ngày!')
          .addFields(
            {
              name: '🎮 Trò chơi',
              value: [
                '`/blackjack cuoc` : Đấu bài nhà cái, trả 3:2 · `/taixiu` `/baucua` `/coinflip` `/slots` : cược nhanh',
                '`/keo nguoi cuoc` : Solo 1v1 tung xu · `/duangua` : cả kênh đua ngựa theo odds',
                '`/trieuphu` : Ai Là Triệu Phú, 1 lần/ngày, reset nhanh bằng tiền nạp (2.000đ)',
                '`/xoso mua so:<0-99>` : Vé số, quay 21h, jackpot dồn',
                'Viết tắt: `/bj` `/tx` `/bc` `/cf`',
              ].join('\n'),
            },
            {
              name: '💰 Kinh tế & Ngân hàng',
              value: [
                '`/daily` `/lamviec` : Kiếm xu miễn phí · `/chuyentien` : Chuyển xu',
                '`/bank gui|rut|xem` : Gửi két thì trộm không đụng được',
                '`/sodu` `/lichsu` `/top` : Ví, lịch sử, bảng xếp hạng',
                '`/cash xem` : Tiền nạp 💵 (VND) cho tính năng premium',
              ].join('\n'),
            },
            {
              name: '🏙️ Đời sống',
              value: [
                '`/trom nguoi` : Trộm ví người khác, 40% ăn, trượt thì bóc lịch 30 phút',
                '`/nopphat` : Nộp 2.000 xu ra tù sớm',
                '`/shop` `/mua` `/tuido` : Sắm khiên chống trộm, nhẫn cầu hôn, hộp quà',
                '`/cauhon nguoi` : Cầu hôn (cần 💍 trong túi) · `/lyhon` : Đường ai nấy đi',
              ].join('\n'),
            },
            {
              name: '🎭 Tương tác & Bản tin',
              value: [
                '`/om` `/hon` `/danh` `/choc` `/xoadau` : Thể hiện cảm xúc kèm GIF',
                '`/bantin xem` : Bản tin sòng bạc hằng ngày (tự đăng 10h, chỉnh: `/bantin config`)',
              ].join('\n'),
            },
            ...prefixField,
          )
          .setFooter({ text: 'Xu chỉ để giải trí, không có giá trị thật. Chơi vui thôi nhé!' }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
