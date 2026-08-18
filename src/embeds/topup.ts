import { EmbedBuilder } from 'discord.js';
import { env } from '../config/env.js';
import { COLORS } from './format.js';

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

export function topupEmbed(amount: number, code: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`💵 Nạp ${formatVnd(amount)}`)
    .setDescription(
      [
        'Mở app ngân hàng, quét mã QR bên dưới là mọi thông tin tự điền sẵn.',
        '',
        `🏦 Ngân hàng: **${env.SEPAY_BANK}**`,
        `🔢 Số tài khoản: **${env.SEPAY_ACCOUNT}**`,
        env.SEPAY_HOLDER ? `👤 Chủ tài khoản: **${env.SEPAY_HOLDER}**` : '',
        `💬 Nội dung chuyển khoản: **${code}**`,
        '',
        '⚠️ Phải giữ đúng nội dung chuyển khoản, sai là tiền không tự vào ví.',
        'Chuyển xong khoảng 5 giây bot sẽ nhắn riêng xác nhận. Mã có hiệu lực 24 giờ.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setImage(buildQrUrl(amount, code))
    .setFooter({ text: 'Tiền nạp chỉ dùng trong bot, không quy đổi ngược ra tiền thật.' });
}
