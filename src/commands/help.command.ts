import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn chơi và danh sách lệnh'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
              ].join('\n'),
            },
            {
              name: '💰 Tiền tệ',
              value: [
                '`/daily` : Điểm danh nhận 500 xu mỗi ngày, chuỗi liên tục tối đa 1.000 xu',
                '`/sodu` : Xem ví và thống kê thắng thua',
                '`/chuyentien nguoi:<@ai> soxu:<xu>` : Chuyển xu cho bạn bè',
                '`/top` : Bảng xếp hạng đại gia',
              ].join('\n'),
            },
          )
          .setFooter({ text: 'Xu chỉ để giải trí, không có giá trị thật. Chơi vui thôi nhé!' }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
