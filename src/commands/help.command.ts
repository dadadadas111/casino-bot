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
                '`/blackjack cuoc:<xu>` : Đấu bài với nhà cái, blackjack trả 3:2',
                '`/taixiu cuoc:<xu> chon:<tài|xỉu>` : Lắc 3 xúc xắc, ra bão là thua',
                '`/baucua cuoc:<xu> chon:<linh vật>` : Bầu cua tôm cá, mỗi mặt trúng ăn 1:1',
                '`/coinflip cuoc:<xu> chon:<ngửa|sấp>` : Tung đồng xu 50/50',
                '`/slots cuoc:<xu>` : Máy xèng, 7️⃣7️⃣7️⃣ ăn x100',
                '`/keo nguoi:<@ai> cuoc:<xu>` : Solo 1v1 tung đồng xu, ai thắng ăn cả',
                '`/trieuphu` : Ai Là Triệu Phú, 15 câu hỏi, tối đa 15.000 xu, 1 lần/ngày',
                'Viết tắt: `/bj` `/tx` `/bc` `/cf`',
              ].join('\n'),
            },
            {
              name: '🎭 Tương tác vui',
              value:
                '`/om` `/hon` `/danh` `/choc` `/xoadau` `nguoi:<@ai>` : Thể hiện cảm xúc kèm GIF',
            },
            {
              name: '💰 Tiền tệ',
              value: [
                '`/daily` : Điểm danh nhận 500 xu mỗi ngày, chuỗi liên tục tối đa 1.000 xu',
                '`/lamviec` (hoặc `/work`) : Làm việc kiếm 100-300 xu, mỗi giờ một lần',
                '`/sodu` : Xem ví và thống kê thắng thua',
                '`/chuyentien nguoi:<@ai> soxu:<xu>` : Chuyển xu cho bạn bè',
                '`/lichsu [nguoi]` : Lịch sử biến động số dư, xem của mình hoặc người khác',
                '`/top` : Bảng xếp hạng đại gia',
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
