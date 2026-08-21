/**
 * "What should I do next?" advisor. Reads a snapshot of a player's state and
 * returns ranked suggestions, most urgent first. Pure logic, no Discord or DB,
 * so the priority order can be tested exactly.
 */

export interface AdvisorState {
  jailed: boolean;
  jailFee: number;
  hospitalized: boolean;
  hospitalFee: number;
  hasKey: boolean;
  loanOverdue: boolean;
  loanDueSoonHours: number | null; // hours until due, when a loan is open and not overdue
  loanOwed: number;
  canDaily: boolean;
  workReady: boolean;
  isChutich: boolean;
  quizReady: boolean;
  wallet: number;
  bank: number;
  cash: number; // tiền nạp (VND), not yet exchanged
  jackpot: number;
}

export interface Advice {
  key: string;
  icon: string;
  title: string;
  detail: string;
}

/** Bank anything above this so a thief cannot reach it. */
export const EXPOSED_WALLET = 10_000;
/** Warn about a loan when this close to its due time. */
export const LOAN_SOON_HOURS = 6;

/** Ranked suggestions for the given state. Highest urgency first. */
export function recommend(s: AdvisorState): Advice[] {
  const out: Advice[] = [];

  // 1. Confinement blocks everything else, so it comes first.
  if (s.jailed) {
    out.push({
      key: 'jail',
      icon: '🚔',
      title: 'Ra tù đã',
      detail: s.hasKey
        ? 'Bạn có 🗝️ chìa khóa, dùng để vượt ngục khỏi tốn xu.'
        : `Mở \`/hoso\` bấm Nộp phạt ${s.jailFee.toLocaleString('vi-VN')} xu để ra sớm, còn không thì ngồi chờ hết hạn.`,
    });
  }
  if (s.hospitalized) {
    out.push({
      key: 'hospital',
      icon: '🏥',
      title: 'Xuất viện đã',
      detail: s.hasKey
        ? 'Bạn có 🗝️ chìa khóa, dùng để trốn viện khỏi tốn xu.'
        : `Mở \`/hoso\` bấm Trả viện phí ${s.hospitalFee.toLocaleString('vi-VN')} xu để ra sớm.`,
    });
  }

  // 2. A loan is the only thing that can seize your assets.
  if (s.loanOverdue) {
    out.push({
      key: 'loan_overdue',
      icon: '🔥',
      title: 'Trả nợ gấp!',
      detail: `Khoản vay ${s.loanOwed.toLocaleString('vi-VN')} xu đã quá hạn, lãi phạt đang chạy và có thể bị siết nhà siết xe. Vào \`/vi\` trả ngay.`,
    });
  } else if (s.loanDueSoonHours !== null && s.loanDueSoonHours <= LOAN_SOON_HOURS) {
    out.push({
      key: 'loan_soon',
      icon: '🧾',
      title: 'Nợ sắp tới hạn',
      detail: `Còn khoảng ${s.loanDueSoonHours} giờ nữa phải trả ${s.loanOwed.toLocaleString('vi-VN')} xu. Trả sớm trong \`/vi\` cho nhẹ đầu.`,
    });
  }

  // 3. Free / ready income — grab it before spending time gambling.
  if (s.canDaily) {
    out.push({
      key: 'daily',
      icon: '📅',
      title: 'Điểm danh nhận xu',
      detail: 'Hôm nay chưa điểm danh. `/daily` nhận xu miễn phí, chuỗi càng dài càng nhiều.',
    });
  }
  if (s.quizReady) {
    out.push({
      key: 'quiz',
      icon: '💰',
      title: 'Ghế nóng đang mở',
      detail: '`/trieuphu` đã sẵn sàng, trả lời đúng ăn tới 100.000 xu. Đây là cách kiếm xu lời nhất mỗi lượt.',
    });
  }
  if (s.workReady) {
    out.push({
      key: 'work',
      icon: s.isChutich ? '🏦' : '🔨',
      title: s.isChutich ? 'Vào phòng họp' : 'Đi làm kiếm xu',
      detail: s.isChutich
        ? '`/lamviec` sẵn sàng. Là Chủ tịch, một nửa số ca là quyết định điều hành ăn đậm.'
        : '`/lamviec` sẵn sàng, kiếm xu đều tay và tích ca lên chức.',
    });
  }

  // 4. Housekeeping: protect and deploy idle money.
  if (s.wallet > EXPOSED_WALLET) {
    out.push({
      key: 'bank',
      icon: '🏦',
      title: 'Cất tiền vào két',
      detail: `Ví đang có ${s.wallet.toLocaleString('vi-VN')} xu, trộm móc được đấy. Gửi bớt vào két trong \`/vi\` cho an toàn.`,
    });
  }
  if (s.cash > 0) {
    out.push({
      key: 'exchange',
      icon: '💵',
      title: 'Đổi tiền nạp ra xu',
      detail: `Bạn còn ${s.cash.toLocaleString('vi-VN')}đ tiền nạp chưa dùng. Đổi sang xu trong \`/vi\` để chơi.`,
    });
  }

  // 5. Nothing pressing: point at the fun.
  if (out.length === 0) {
    out.push({
      key: 'play',
      icon: '🎰',
      title: 'Rảnh thì vào sòng',
      detail: `Không có gì gấp cả. Thử \`/hilo\`, \`/domin\` hay \`/blackjack\`. Hũ xổ số đang ${s.jackpot.toLocaleString('vi-VN')} xu, mua vé \`/xoso\`.`,
    });
  }

  return out;
}
