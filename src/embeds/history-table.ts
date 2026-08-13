import type { HistoryEntry } from '../services/economy.service.js';

/**
 * Mobile-first history rendering. ANSI tables looked great on desktop but
 * phones neither render ANSI colors nor fit wide monospace rows, so: emoji
 * squares carry the +/- color, entries are grouped under per-day headers to
 * keep every line short, and plain markdown lets mentions render again.
 */

export const GAME_LABELS: Record<string, string> = {
  blackjack: 'Blackjack',
  blackjack_double: 'BJ gấp đôi',
  taixiu: 'Tài xỉu',
  baucua: 'Bầu cua',
  coinflip: 'Tung xu',
  slots: 'Xèng',
  keo: 'Kèo 1v1',
  trieuphu: 'Triệu phú',
  coquay: 'Cò quay Nga',
  duangua: 'Đua ngựa',
  xoso: 'Xổ số',
};

export function typeLabel(entry: HistoryEntry): string {
  const game = GAME_LABELS[entry.meta ?? ''] ?? '';
  switch (entry.type) {
    case 'welcome':
      return 'Quà tân thủ';
    case 'daily':
      return 'Điểm danh';
    case 'work':
      return 'Làm việc';
    case 'bet':
      return `Cược ${game}`.trim();
    case 'payout':
      return `Thưởng ${game}`.trim();
    case 'refund':
      return 'Hoàn cược';
    case 'transfer_out':
      return entry.meta ? `Chuyển cho <@${entry.meta}>` : 'Chuyển xu đi';
    case 'transfer_in':
      return entry.meta ? `Nhận từ <@${entry.meta}>` : 'Nhận chuyển xu';
    case 'admin_add':
      return 'Admin cộng';
    case 'admin_sub':
      return 'Admin trừ';
    case 'admin_set':
      return 'Admin đặt số dư';
    case 'bank_in':
      return 'Gửi vào két';
    case 'bank_out':
      return 'Rút khỏi két';
    case 'rob_in':
      return entry.meta ? `Trộm được của <@${entry.meta}>` : 'Trộm được';
    case 'rob_out':
      return entry.meta ? `Bị <@${entry.meta}> trộm` : 'Bị trộm';
    case 'bail':
      return 'Nộp phạt ra tù';
    case 'medical':
      return 'Trả viện phí';
    case 'divorce_fee':
      return 'Phí ly hôn';
    case 'item':
      return 'Mua đồ shop';
    case 'gift_box':
      return 'Mở hộp quà';
    case 'exchange':
      return `Đổi tiền nạp${entry.meta ? ` (${entry.meta})` : ''}`;
    case 'buff_bonus':
      return `Thưởng bùa may mắn${game ? ` (${game})` : ''}`;
    case 'wedding_cost':
      return 'Đặt tiệc cưới';
    case 'wedding_gift':
      return entry.amount >= 0 ? 'Tiền mừng cưới' : 'Đi mừng cưới';
    default:
      return entry.type;
  }
}

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
});

function parseUtc(createdAt: string): Date {
  return new Date(`${createdAt.replace(' ', 'T')}Z`);
}

/** SQLite UTC "YYYY-MM-DD HH:MM:SS" -> "HH:mm dd/MM" in Vietnam time. */
export function formatWhen(createdAt: string): string {
  const date = parseUtc(createdAt);
  return `${timeFmt.format(date)} ${dateFmt.format(date)}`;
}

export function historyTable(entries: HistoryEntry[]): string {
  const lines: string[] = [];
  let currentDay = '';
  for (const entry of entries) {
    const date = parseUtc(entry.createdAt);
    const day = dateFmt.format(date);
    if (day !== currentDay) {
      currentDay = day;
      lines.push(`📅 **${day}**`);
    }
    const square = entry.amount >= 0 ? '🟩' : '🟥';
    const sign = entry.amount >= 0 ? '+' : '';
    lines.push(
      `${square} **${sign}${entry.amount.toLocaleString('vi-VN')}** → ${entry.balanceAfter.toLocaleString('vi-VN')} · ${typeLabel(entry)} · ${timeFmt.format(date)}`,
    );
  }
  return lines.join('\n');
}
