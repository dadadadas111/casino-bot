import { JOB_RANKS } from './job.service.js';

/**
 * The boardroom: once a player reaches Chủ tịch, half their shifts stop being
 * a quiet payday and become a decision that steers the company. Some choices
 * have a clear right answer, some are a coin toss, and a few are the player
 * knowingly betting the company — the only path to losing the title.
 *
 * Pure logic and a static scenario list, so it plays without the database or
 * the AI pool. The pool enrichment (Triệu Phú style) layers on top later.
 */

export const BOARD_CHANCE = 0.5; // of Chủ tịch shifts that trigger a decision
export const CHUTICH_FLOOR = 500;

export type ScenarioKind = 'clear' | 'luck' | 'risk';

/** What an outcome does to this shift. `mult` scales the base wage. */
export type Effect =
  | { kind: 'pay'; mult: number }
  | { kind: 'demote'; toRank: string };

export interface Outcome {
  weight: number;
  effect: Effect;
  /** Narration shown when this outcome lands. */
  text: string;
}

export interface BoardOption {
  label: string;
  /** Risky options carry demotion and advertise it on the button. */
  risky?: boolean;
  outcomes: Outcome[];
}

export interface Scenario {
  id: string;
  kind: ScenarioKind;
  situation: string;
  options: BoardOption[];
}

/** Pick an outcome by weight. `roll` is in [0, 1). Pure. */
export function rollOutcome(outcomes: Outcome[], roll: number = Math.random()): Outcome {
  const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
  let target = roll * total;
  for (const outcome of outcomes) {
    target -= outcome.weight;
    if (target < 0) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

/** The worst-case demotion an option can inflict, for labelling the button. */
export function demotionChance(option: BoardOption): number {
  const total = option.outcomes.reduce((sum, o) => sum + o.weight, 0);
  const bad = option.outcomes
    .filter((o) => o.effect.kind === 'demote')
    .reduce((sum, o) => sum + o.weight, 0);
  return total > 0 ? bad / total : 0;
}

/** work_count a demotion drops the player to (the target rank's floor). */
export function demoteFloor(toRank: string): number {
  return JOB_RANKS.find((r) => r.key === toRank)?.from ?? 0;
}

const pay = (mult: number, text: string): Outcome => ({ weight: 0, effect: { kind: 'pay', mult }, text });
const demote = (toRank: string, text: string): Outcome => ({
  weight: 0,
  effect: { kind: 'demote', toRank },
  text,
});
const w = (weight: number, o: Outcome): Outcome => ({ ...o, weight });

/**
 * The starting deck. Clear scenarios reward reading the situation; luck ones
 * are a wash with variance; risk ones let the player gamble the title.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: 'luong',
    kind: 'clear',
    situation: 'Trưởng phòng giỏi nhất công ty xin nghỉ vì lương thấp hơn thị trường. Bạn làm gì?',
    options: [
      {
        label: 'Tăng lương giữ người',
        outcomes: [w(1, pay(1.5, 'Giữ được người tài, cả phòng làm hăng, dự án về đích sớm.'))],
      },
      {
        label: 'Kệ, tuyển người mới rẻ hơn',
        outcomes: [w(1, pay(0.6, 'Người mới non tay, năng suất tụt, khách phàn nàn cả tháng.'))],
      },
    ],
  },
  {
    id: 'hopdong',
    kind: 'clear',
    situation: 'Một hợp đồng lớn có điều khoản phạt nặng nếu trễ hạn, mà lịch thì gấp. Bạn?',
    options: [
      {
        label: 'Thương lượng giãn tiến độ trước khi ký',
        outcomes: [w(1, pay(1.4, 'Đối tác đồng ý nới hạn, ký xong làm thong thả, ăn trọn tiền.'))],
      },
      {
        label: 'Cứ ký cho nhanh, tính sau',
        outcomes: [
          w(6, pay(0.4, 'Trễ hạn thật, dính điều khoản phạt, lãi thành lỗ.')),
          w(4, pay(1.1, 'May mà kịp deadline trong gang tấc, hú hồn.')),
        ],
      },
    ],
  },
  {
    id: 'kiemtoan',
    kind: 'clear',
    situation: 'Kế toán báo sổ sách có chỗ lệch mập mờ, sắp tới kỳ kiểm toán. Bạn?',
    options: [
      {
        label: 'Rà soát minh bạch trước khi họ tới',
        outcomes: [w(1, pay(1.3, 'Sổ sạch, kiểm toán khen, uy tín công ty lên giá.'))],
      },
      {
        label: 'Giấu đi, hy vọng không ai soi',
        risky: true,
        outcomes: [
          w(2, pay(1.2, 'Lần này thoát, nhưng tim đập chân run cả buổi.')),
          w(1, demote('giamdoc', 'Bị phát hiện gian lận sổ sách, hội đồng cách chức tại chỗ.')),
        ],
      },
    ],
  },
  {
    id: 'khunghoang',
    kind: 'clear',
    situation: 'Truyền thông đưa tin xấu về sản phẩm, dư luận đang nóng. Bạn?',
    options: [
      {
        label: 'Ra thông cáo xin lỗi và thu hồi',
        outcomes: [w(1, pay(1.2, 'Xử lý khủng hoảng khéo, khách quay lại, thậm chí quý hơn.'))],
      },
      {
        label: 'Im lặng cho qua',
        outcomes: [w(1, pay(0.5, 'Dư luận càng làm tới, doanh số rơi tự do.'))],
      },
    ],
  },
  {
    id: 'startup',
    kind: 'luck',
    situation: 'Một startup lạ mời rót vốn, hứa hẹn thì hay mà tương lai thì mù mờ. Bạn?',
    options: [
      {
        label: 'Rót vốn thử vận',
        outcomes: [
          w(45, pay(2.8, 'Startup bùng nổ, cổ phần tăng gấp mấy lần, lời to!')),
          w(55, pay(0.3, 'Startup sập tiệm, tiền đầu tư bốc hơi gần hết.')),
        ],
      },
      { label: 'Bỏ qua, giữ tiền cho chắc', outcomes: [w(1, pay(1, 'Một ngày làm việc yên ả, không lời không lỗ.'))] },
    ],
  },
  {
    id: 'quangcao',
    kind: 'luck',
    situation: 'Agency đề xuất chiến dịch quảng cáo bạo tay, ăn cả ngã cả. Bạn?',
    options: [
      {
        label: 'Duyệt ngân sách khủng',
        outcomes: [
          w(1, pay(2.2, 'Chiến dịch viral, đơn hàng nổ ầm ầm.')),
          w(1, pay(0.4, 'Quảng cáo nhạt, tiền đổ sông đổ biển.')),
        ],
      },
      { label: 'Làm nhỏ cho an toàn', outcomes: [w(1, pay(1.05, 'Hiệu quả tàng tàng, đủ ăn.'))] },
    ],
  },
  {
    id: 'doitac',
    kind: 'luck',
    situation: 'Một đối tác nước ngoài muốn hợp tác lớn nhưng bạn chưa rõ họ có đáng tin không. Bạn?',
    options: [
      {
        label: 'Bắt tay làm ăn',
        outcomes: [
          w(1, pay(2.5, 'Đối tác xịn, mở ra thị trường mới, tiền vào như nước.')),
          w(1, pay(0.5, 'Bị lật kèo phút chót, mất cọc.')),
        ],
      },
      { label: 'Từ chối cho lành', outcomes: [w(1, pay(1, 'Bỏ lỡ cũng chẳng sao, đời còn dài.'))] },
    ],
  },
  {
    id: 'xoso_cty',
    kind: 'luck',
    situation: 'Nhân viên rủ cả công ty hùn tiền mua vé số, bạn cũng được mời góp quỹ. Bạn?',
    options: [
      {
        label: 'Góp cho vui',
        outcomes: [
          w(2, pay(3.5, 'Trúng giải! Cả công ty ăn mừng, sếp chia phần đậm.')),
          w(8, pay(0.8, 'Trượt, mất chút tiền quỹ, coi như mua vui.')),
        ],
      },
      { label: 'Cảm ơn, tôi không chơi', outcomes: [w(1, pay(1, 'Đứng ngoài nhìn, chẳng mất gì.'))] },
    ],
  },
  {
    id: 'thaotung',
    kind: 'risk',
    situation: 'Đối thủ hạ giá phá thị trường. Bạn có thể vay lớn đánh úp giành thị phần, hoặc thủ.',
    options: [
      { label: 'Giữ giá, chịu mất ít khách', outcomes: [w(1, pay(0.85, 'Mất vài khách nhưng công ty vẫn vững.'))] },
      {
        label: 'Vay lớn đánh úp',
        risky: true,
        outcomes: [
          w(40, pay(4, 'Nuốt trọn thị phần đối thủ, thắng lớn ngoạn mục!')),
          w(45, pay(0.2, 'Đối thủ trường vốn hơn, lỗ nặng nhưng gượng được.')),
          w(15, demote('nhanvien', 'Vay quá tay, thị trường quay xe, công ty vỡ nợ. Bạn mất ghế Chủ tịch.')),
        ],
      },
    ],
  },
  {
    id: 'ipo',
    kind: 'risk',
    situation: 'Ngân hàng khuyên đưa công ty lên sàn ngay lúc thị trường đầy biến động. Bạn?',
    options: [
      { label: 'Hoãn, chờ thị trường ổn', outcomes: [w(1, pay(0.9, 'An toàn qua sóng gió, không lời nhiều.'))] },
      {
        label: 'IPO ngay, đánh cược thời điểm',
        risky: true,
        outcomes: [
          w(38, pay(4.5, 'Cổ phiếu bốc đầu, bạn thành huyền thoại phố Wall!')),
          w(47, pay(0.3, 'Giá lao dốc ngay ngày đầu, nhà đầu tư la ó.')),
          w(15, demote('giamdoc', 'IPO thảm họa, hội đồng quản trị phế truất bạn.')),
        ],
      },
    ],
  },
  {
    id: 'sapnhap',
    kind: 'risk',
    situation: 'Một tập đoàn lớn đề nghị sáp nhập, nhưng bạn sẽ mất quyền kiểm soát nếu thương vụ hỏng.',
    options: [
      { label: 'Từ chối, giữ độc lập', outcomes: [w(1, pay(0.9, 'Vẫn là ông chủ của chính mình.'))] },
      {
        label: 'Đặt cược cả công ty vào thương vụ',
        risky: true,
        outcomes: [
          w(35, pay(5, 'Thương vụ thế kỷ! Bạn ôm về khối tài sản khổng lồ.')),
          w(40, pay(0.2, 'Đàm phán đổ bể, công ty rệu rã nhưng chưa chết.')),
          w(25, demote('chayvat', 'Sáp nhập thất bại thảm hại, mất trắng tất cả. Về vạch xuất phát làm lại.')),
        ],
      },
    ],
  },
  {
    id: 'canhbac',
    kind: 'risk',
    situation: 'Quỹ đầu tư mạo hiểm rủ bạn all-in vào một canh bạc tiền số. Được ăn cả ngã về không.',
    options: [
      { label: 'Không, tôi làm ăn đàng hoàng', outcomes: [w(1, pay(0.95, 'Ngủ ngon, không nợ nần.'))] },
      {
        label: 'All-in tiền số',
        risky: true,
        outcomes: [
          w(33, pay(5, 'Trúng đỉnh sóng, x5 tài khoản công ty!')),
          w(37, pay(0.1, 'Đu đỉnh, cháy gần sạch nhưng còn cái quần.')),
          w(30, demote('nhanvien', 'Cháy tài khoản, công ty phá sản, bạn về làm nhân viên quèn.')),
        ],
      },
    ],
  },
];
