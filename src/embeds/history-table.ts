import type { HistoryEntry } from '../services/economy.service.js';

/**
 * Renders history as an ANSI code block: the only Discord construct that gives
 * both true monospace column alignment and red/green amounts. Inside a code
 * block emoji, mentions and dynamic timestamps do not render, so labels are
 * plain text and times are fixed Vietnam-timezone strings.
 */

const WHEN_W = 11;
const LABEL_W = 16;
const AMOUNT_W = 8;
const BAL_W = 9;

const GREEN = '[32m';
const RED = '[31m';
const BOLD = '[1m';
const RESET = '[0m';

const GAME_LABELS: Record<string, string> = {
  blackjack: 'Blackjack',
  blackjack_double: 'BJ gấp đôi',
  taixiu: 'Tài xỉu',
  baucua: 'Bầu cua',
  coinflip: 'Tung xu',
  slots: 'Xèng',
  keo: 'Kèo 1v1',
};

export function typeLabel(entry: HistoryEntry): string {
  const game = GAME_LABELS[entry.meta ?? ''] ?? '';
  switch (entry.type) {
    case 'welcome':
      return 'Quà tân thủ';
    case 'daily':
      return 'Điểm danh';
    case 'bet':
      return `Cược ${game}`.trim();
    case 'payout':
      return `Thưởng ${game}`.trim();
    case 'refund':
      return 'Hoàn cược';
    case 'transfer_out':
      return 'Chuyển xu đi';
    case 'transfer_in':
      return 'Nhận chuyển xu';
    case 'admin_add':
      return 'Admin cộng';
    case 'admin_sub':
      return 'Admin trừ';
    case 'admin_set':
      return 'Admin đặt số dư';
    default:
      return entry.type;
  }
}

// en-GB gives "14:30" and "11/08"; vi-VN would render the date as "11-08".
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

/** SQLite UTC "YYYY-MM-DD HH:MM:SS" -> "HH:mm dd/MM" in Vietnam time. */
export function formatWhen(createdAt: string): string {
  const date = new Date(`${createdAt.replace(' ', 'T')}Z`);
  return `${timeFmt.format(date)} ${dateFmt.format(date)}`;
}

function clip(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

export function historyTable(entries: HistoryEntry[]): string {
  const header =
    BOLD +
    `${'Thời gian'.padEnd(WHEN_W)}  ${'Giao dịch'.padEnd(LABEL_W)} ${'+/-'.padStart(AMOUNT_W)} ${'Số dư'.padStart(BAL_W)}` +
    RESET;
  const rows = entries.map((entry) => {
    const when = formatWhen(entry.createdAt).padEnd(WHEN_W);
    const label = clip(typeLabel(entry), LABEL_W);
    const amountText = `${entry.amount >= 0 ? '+' : ''}${entry.amount.toLocaleString('vi-VN')}`;
    const amount = (entry.amount >= 0 ? GREEN : RED) + amountText.padStart(AMOUNT_W) + RESET;
    const balance = entry.balanceAfter.toLocaleString('vi-VN').padStart(BAL_W);
    return `${when}  ${label} ${amount} ${balance}`;
  });
  return ['```ansi', header, ...rows, '```'].join('\n');
}
