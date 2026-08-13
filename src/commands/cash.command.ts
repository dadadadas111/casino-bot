import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { cash, topups } from '../context.js';
import { env } from '../config/env.js';
import { MAX_TOPUP, MIN_TOPUP } from '../services/topup.service.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ 💵`;
}

/** VietQR image with the amount and payment memo pre-filled. */
export function buildQrUrl(amount: number, code: string): string {
  const params = new URLSearchParams({
    acc: env.SEPAY_ACCOUNT,
    bank: env.SEPAY_BANK,
    amount: String(amount),
    des: code,
    template: 'compact',
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export const napCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nap')
    .setDescription('Nạp tiền vào ví 💵 bằng chuyển khoản ngân hàng (quét QR là xong)')
    .addIntegerOption((o) =>
      o
        .setName('sotien')
        .setDescription(`Số tiền VND muốn nạp (${MIN_TOPUP.toLocaleString('vi-VN')} - ${MAX_TOPUP.toLocaleString('vi-VN')})`)
        .setRequired(true)
        .setMinValue(MIN_TOPUP)
        .setMaxValue(MAX_TOPUP),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!env.SEPAY_ACCOUNT) {
      await interaction.reply({
        content: 'Tính năng nạp tiền chưa được cấu hình. Liên hệ chủ bot nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const amount = interaction.options.getInteger('sotien', true);
    const request = topups.createRequest(interaction.user.id, amount);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle(`💵 Nạp ${formatVnd(amount)}`)
          .setDescription(
            [
              'Mở app ngân hàng, quét mã QR bên dưới là mọi thông tin tự điền sẵn.',
              '',
              `🏦 Ngân hàng: **${env.SEPAY_BANK}**`,
              `🔢 Số tài khoản: **${env.SEPAY_ACCOUNT}**`,
              env.SEPAY_HOLDER ? `👤 Chủ tài khoản: **${env.SEPAY_HOLDER}**` : '',
              `💬 Nội dung chuyển khoản: **${request.code}**`,
              '',
              '⚠️ Phải giữ đúng nội dung chuyển khoản, sai là tiền không tự vào ví.',
              'Chuyển xong khoảng 5 giây bot sẽ nhắn riêng xác nhận. Mã có hiệu lực 24 giờ.',
            ]
              .filter(Boolean)
              .join('\n'),
          )
          .setImage(buildQrUrl(amount, request.code))
          .setFooter({ text: 'Tiền nạp chỉ dùng trong bot, không quy đổi ngược ra tiền thật.' }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const cashCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cash')
    .setDescription('Tiền nạp (VND): dùng reset cooldown Triệu phú và đồ premium')
    .addSubcommand((sc) => sc.setName('xem').setDescription('Xem số dư tiền nạp của bạn'))
    .addSubcommand((sc) =>
      sc
        .setName('nap')
        .setDescription('Cộng tiền nạp cho người chơi (chỉ chủ bot)')
        .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('sotien').setDescription('Số tiền VND').setRequired(true).setMinValue(1_000),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.options.getSubcommand() === 'nap') {
      // Real money on the line: only the bot owner may credit, never guild admins.
      if (!env.BOT_OWNER_ID || interaction.user.id !== env.BOT_OWNER_ID) {
        await interaction.reply({
          content: 'Chỉ chủ bot mới cộng được tiền nạp.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const target = interaction.options.getUser('nguoi', true);
      const amount = interaction.options.getInteger('sotien', true);
      cash.credit(target.id, amount, `manual:${interaction.user.id}`);
      await interaction.reply({
        content: `💵 Đã cộng ${formatVnd(amount)} cho **${target.displayName}**. Số dư nạp mới: ${formatVnd(cash.get(target.id))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('💵 Tiền nạp')
          .setDescription(
            [
              `Số dư của bạn: **${formatVnd(cash.get(interaction.user.id))}**`,
              '',
              'Dùng để: reset cooldown Ai Là Triệu Phú (2.000đ/lần), và các món premium sắp ra mắt.',
              'Nạp bằng `/nap sotien:<VND>`: quét QR chuyển khoản, tiền vào ví sau vài giây.',
              'Lưu ý: tiền nạp chỉ dùng trong bot, không quy đổi ngược ra tiền thật, không mua được xu.',
            ].join('\n'),
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
