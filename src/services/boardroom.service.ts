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
  {
    id: 'c_giunhan',
    kind: 'clear',
    situation: 'Đối thủ chèo kéo nhân viên chủ chốt của bạn bằng lương gấp rưỡi. Bạn?',
    options: [
      { label: 'Ra giá giữ chân, thưởng thêm cổ phần', outcomes: [w(1, pay(1.5, 'Giữ được người, cả nhóm yên tâm cống hiến, dự án về đích.'))] },
      { label: 'Kệ, ai đi thì đi', outcomes: [w(1, pay(0.6, 'Người giỏi ra đi, mang cả khách theo, doanh số hụt hẳn.'))] },
    ],
  },
  {
    id: 'c_server',
    kind: 'clear',
    situation: 'Hệ thống cũ hay sập giờ cao điểm, kỹ thuật xin nâng cấp. Bạn?',
    options: [
      { label: 'Duyệt nâng cấp hạ tầng', outcomes: [w(1, pay(1.4, 'Hệ thống mượt, khách chốt đơn ào ào, doanh thu bật lên.'))] },
      { label: 'Vá tạm cho rẻ', outcomes: [w(1, pay(0.55, 'Sập ngay lúc đông khách, mất cả tá hợp đồng.'))] },
    ],
  },
  {
    id: 'c_vip',
    kind: 'clear',
    situation: 'Khách VIP phàn nàn dữ dội về dịch vụ trên mạng xã hội. Bạn?',
    options: [
      { label: 'Đích thân xin lỗi và bù đắp', outcomes: [w(1, pay(1.35, 'Khách cảm động, quay lại còn giới thiệu thêm bạn bè.'))] },
      { label: 'Coi như không thấy', outcomes: [w(1, pay(0.5, 'Bài viết viral theo hướng xấu, ai cũng ngại tới.'))] },
    ],
  },
  {
    id: 'c_baomat',
    kind: 'clear',
    situation: 'Đội an ninh báo có lỗ hổng bảo mật nghiêm trọng. Bạn?',
    options: [
      { label: 'Vá ngay dù tốn kém', outcomes: [w(1, pay(1.3, 'Chặn kịp trước khi bị tấn công, khách tin tưởng hơn.'))] },
      { label: 'Để tuần sau tính', outcomes: [w(1, pay(0.4, 'Bị hack, lộ dữ liệu khách, bồi thường sấp mặt.'))] },
    ],
  },
  {
    id: 'c_kietsuc',
    kind: 'clear',
    situation: 'Cả phòng kiệt sức sau mùa cao điểm, năng suất tụt. Bạn?',
    options: [
      { label: 'Cho nghỉ ngơi và thưởng nóng', outcomes: [w(1, pay(1.4, 'Nhân viên hồi sức, quý sau bùng nổ năng suất.'))] },
      { label: 'Ép tăng ca tiếp', outcomes: [w(1, pay(0.5, 'Nghỉ việc hàng loạt, phải tuyển lại từ đầu.'))] },
    ],
  },
  {
    id: 'c_thuhoi',
    kind: 'clear',
    situation: 'Một lô sản phẩm bị lỗi kỹ thuật đã ra thị trường. Bạn?',
    options: [
      { label: 'Chủ động thu hồi và xin lỗi', outcomes: [w(1, pay(1.3, 'Xử lý minh bạch, thương hiệu còn được khen tử tế.'))] },
      { label: 'Im lặng bán nốt cho hết', outcomes: [w(1, pay(0.45, 'Khách phát hiện, tẩy chay dây chuyền.'))] },
    ],
  },
  {
    id: 'c_chiphi',
    kind: 'clear',
    situation: 'Chi phí vận hành phình to bất thường, kế toán báo động. Bạn?',
    options: [
      { label: 'Rà soát, cắt khoản lãng phí', outcomes: [w(1, pay(1.35, 'Bộ máy gọn lại, lợi nhuận biên đẹp hẳn.'))] },
      { label: 'Kệ, tiền vào nhiều mà', outcomes: [w(1, pay(0.6, 'Lãng phí ăn mòn, cuối quý lãi thành huề vốn.'))] },
    ],
  },
  {
    id: 'c_khaosat',
    kind: 'clear',
    situation: 'Có cơ hội mở rộng nhưng thị trường mới còn lạ lẫm. Bạn?',
    options: [
      { label: 'Khảo sát kỹ rồi mới vào', outcomes: [w(1, pay(1.3, 'Vào đúng thời điểm, chiếm lĩnh gọn gàng.'))] },
      { label: 'Nhảy vào ngay cho nóng', outcomes: [w(3, pay(0.5, 'Không hiểu thị trường, đốt tiền rồi rút.')), w(2, pay(1.1, 'May mà hợp gu khách địa phương.'))] },
    ],
  },
  {
    id: 'c_tindon',
    kind: 'clear',
    situation: 'Tin đồn nội bộ về cắt giảm nhân sự làm cả công ty hoang mang. Bạn?',
    options: [
      { label: 'Họp toàn thể nói rõ ràng', outcomes: [w(1, pay(1.25, 'Dập tan tin đồn, mọi người yên tâm làm việc.'))] },
      { label: 'Mặc kệ cho tự lắng', outcomes: [w(1, pay(0.6, 'Đồn thổi lan rộng, người giỏi âm thầm rải CV.'))] },
    ],
  },
  {
    id: 'c_tingia',
    kind: 'clear',
    situation: 'Đối thủ tung tin giả bôi nhọ công ty bạn. Bạn?',
    options: [
      { label: 'Phản hồi chuyên nghiệp kèm bằng chứng', outcomes: [w(1, pay(1.3, 'Sự thật thắng thế, uy tín còn tăng.'))] },
      { label: 'Lên mạng cãi tay đôi', outcomes: [w(1, pay(0.55, 'Càng cãi càng lem nhem, khách quay lưng.'))] },
    ],
  },
  {
    id: 'c_nhantai',
    kind: 'clear',
    situation: 'Một nhân viên trẻ đề xuất ý tưởng sản phẩm táo bạo. Bạn?',
    options: [
      { label: 'Cho một nhóm nhỏ thử nghiệm', outcomes: [w(1, pay(1.4, 'Ý tưởng ăn khách, mở ra dòng doanh thu mới.'))] },
      { label: 'Dập ngay, non lắm', outcomes: [w(1, pay(0.7, 'Nhân tài nản lòng, mang ý tưởng sang chỗ khác.'))] },
    ],
  },
  {
    id: 'c_tudonghoa',
    kind: 'clear',
    situation: 'Đề xuất tự động hóa quy trình, tốn phí đầu tư nhưng tiết kiệm về sau. Bạn?',
    options: [
      { label: 'Đầu tư tự động hóa', outcomes: [w(1, pay(1.35, 'Chi phí giảm mạnh, làm cùng người mà ra gấp đôi việc.'))] },
      { label: 'Cứ làm thủ công cho chắc', outcomes: [w(1, pay(0.75, 'Tốn người tốn giờ, đối thủ tự động hóa vượt mặt.'))] },
    ],
  },
  {
    id: 'c_giano',
    kind: 'clear',
    situation: 'Dòng tiền ngắn hạn căng, tới hạn trả nhà cung cấp. Bạn?',
    options: [
      { label: 'Đàm phán giãn nợ đàng hoàng', outcomes: [w(1, pay(1.25, 'Đối tác thông cảm, quan hệ còn bền chặt hơn.'))] },
      { label: 'Vay nóng lãi cắt cổ trả gấp', outcomes: [w(1, pay(0.5, 'Lãi ăn hết lời, tháng sau lại đôn đáo.'))] },
    ],
  },
  {
    id: 'c_dieukhoan',
    kind: 'clear',
    situation: 'Đối tác lớn cài điều khoản bất lợi vào hợp đồng. Bạn?',
    options: [
      { label: 'Đàm phán lại từng điều khoản', outcomes: [w(1, pay(1.3, 'Sửa được các bẫy, ký xong ăn ngon.'))] },
      { label: 'Ký đại cho xong', outcomes: [w(1, pay(0.45, 'Dính bẫy phạt, càng làm càng lỗ.'))] },
    ],
  },
  {
    id: 'c_dinhgia',
    kind: 'clear',
    situation: 'Sản phẩm mới sắp ra, đội bán hàng phân vân định giá. Bạn?',
    options: [
      { label: 'Định giá theo khảo sát thị trường', outcomes: [w(1, pay(1.3, 'Giá vừa túi khách, bán chạy như tôm tươi.'))] },
      { label: 'Phóng giá cao cho sang', outcomes: [w(3, pay(0.5, 'Đắt quá, khách chê, hàng tồn kho.')), w(2, pay(1.2, 'Định vị cao cấp lại hóa hay, khách sang chịu chi.'))] },
    ],
  },
  {
    id: 'c_daotao',
    kind: 'clear',
    situation: 'Nhân viên mới vào nhiều nhưng chưa ai kèm cặp. Bạn?',
    options: [
      { label: 'Lập chương trình đào tạo bài bản', outcomes: [w(1, pay(1.3, 'Lính mới lên tay nhanh, cả đội mạnh đều.'))] },
      { label: 'Ném vào việc cho tự bơi', outcomes: [w(1, pay(0.6, 'Sai sót tùm lum, khách phàn nàn liên tục.'))] },
    ],
  },
  {
    id: 'l_batdongsan',
    kind: 'luck',
    situation: 'Một khu đất mới quy hoạch được rao bán, tin đồn sắp lên giá. Bạn?',
    options: [
      { label: 'Ôm đất chờ thời', outcomes: [w(45, pay(3, 'Quy hoạch thành sự thật, đất tăng gấp mấy lần!')), w(55, pay(0.3, 'Quy hoạch treo, tiền chôn theo đất.'))] },
      { label: 'Thôi, giữ tiền mặt', outcomes: [w(1, pay(1, 'Một ngày làm việc an nhàn, không được không mất.'))] },
    ],
  },
  {
    id: 'l_sanphammoi',
    kind: 'luck',
    situation: 'Đội R&D làm ra sản phẩm lạ, chưa rõ thị trường có đón nhận không. Bạn?',
    options: [
      { label: 'Tung ra thị trường luôn', outcomes: [w(1, pay(2.4, 'Sản phẩm gãi đúng chỗ ngứa, cháy hàng!')), w(1, pay(0.4, 'Thị trường thờ ơ, hàng nằm kho.'))] },
      { label: 'Để trong ngăn kéo đã', outcomes: [w(1, pay(1, 'Chờ thời điểm chín muồi, chưa vội.'))] },
    ],
  },
  {
    id: 'l_daisu',
    kind: 'luck',
    situation: 'Một ngôi sao đang lên muốn làm đại sứ thương hiệu, cát-xê không rẻ. Bạn?',
    options: [
      { label: 'Ký hợp đồng đại sứ', outcomes: [w(1, pay(2.6, 'Ngôi sao viral, thương hiệu nổi như cồn!')), w(1, pay(0.35, 'Ngôi sao dính phốt, kéo luôn công ty xuống.'))] },
      { label: 'Cảm ơn, để dịp khác', outcomes: [w(1, pay(1, 'Không tốn cát-xê, cũng chẳng ồn ào.'))] },
    ],
  },
  {
    id: 'l_chinhanh',
    kind: 'luck',
    situation: 'Một tỉnh xa mời mở chi nhánh, tiềm năng nhưng chưa ai đặt chân. Bạn?',
    options: [
      { label: 'Mở chi nhánh tỉnh xa', outcomes: [w(1, pay(2.5, 'Độc chiếm thị trường mới, tiền về đều tay!')), w(1, pay(0.4, 'Dân địa phương chưa quen, lỗ tiền mặt bằng.'))] },
      { label: 'Tập trung nội thành đã', outcomes: [w(1, pay(1, 'Ăn chắc mặc bền, không phiêu lưu.'))] },
    ],
  },
  {
    id: 'l_congnghe',
    kind: 'luck',
    situation: 'Một xu hướng công nghệ mới đang nóng, ai cũng đổ tiền vào. Bạn?',
    options: [
      { label: 'Đặt cược vào xu hướng', outcomes: [w(1, pay(2.8, 'Bắt đúng sóng, công ty thành người tiên phong!')), w(1, pay(0.3, 'Bong bóng xì hơi, tiền bay theo hype.'))] },
      { label: 'Đứng ngoài quan sát', outcomes: [w(1, pay(1, 'Chờ xem thực hư, chưa nhảy vội.'))] },
    ],
  },
  {
    id: 'l_hanggiare',
    kind: 'luck',
    situation: 'Một nguồn hàng lạ chào lô giá rẻ bất ngờ, chất lượng chưa kiểm chứng. Bạn?',
    options: [
      { label: 'Nhập lô hàng giá hời', outcomes: [w(1, pay(2.3, 'Hàng ngon giá rẻ, lời to một vố!')), w(1, pay(0.35, 'Hàng dởm, khách trả về ầm ầm.'))] },
      { label: 'Nhập nguồn quen cho chắc', outcomes: [w(1, pay(1, 'Giá cao hơn tí nhưng yên tâm.'))] },
    ],
  },
  {
    id: 'l_sukien',
    kind: 'luck',
    situation: 'Kế hoạch tổ chức sự kiện lớn ngoài trời, mà thời tiết thì hên xui. Bạn?',
    options: [
      { label: 'Làm lớn ngoài trời', outcomes: [w(1, pay(2.5, 'Trời đẹp, sự kiện đông nghịt, thương hiệu bay xa!')), w(1, pay(0.4, 'Mưa như trút, khách hủy, tiền cọc mất.'))] },
      { label: 'Làm nhỏ trong nhà', outcomes: [w(1, pay(1.05, 'Chắc ăn, hiệu quả vừa phải.'))] },
    ],
  },
  {
    id: 'l_kol',
    kind: 'luck',
    situation: 'Một KOL triệu follow đề nghị hợp tác, nội dung thì khó đoán viral hay flop. Bạn?',
    options: [
      { label: 'Chốt deal với KOL', outcomes: [w(1, pay(2.7, 'Video triệu view, đơn hàng nổ tung!')), w(1, pay(0.35, 'Nội dung nhạt, tiền quăng xuống sông.'))] },
      { label: 'Tự chạy quảng cáo', outcomes: [w(1, pay(1, 'Hiệu quả đều đều, không bùng nổ.'))] },
    ],
  },
  {
    id: 'l_rnd',
    kind: 'luck',
    situation: 'Đội nghiên cứu xin ngân sách lớn cho một sản phẩm đột phá, chưa chắc thành. Bạn?',
    options: [
      { label: 'Rót vốn nghiên cứu', outcomes: [w(1, pay(3, 'Đột phá thành công, cả ngành phải ngước nhìn!')), w(1, pay(0.3, 'Nghiên cứu bế tắc, tiền đổ biển.'))] },
      { label: 'Làm sản phẩm ăn chắc', outcomes: [w(1, pay(1, 'An toàn, doanh thu ổn định.'))] },
    ],
  },
  {
    id: 'l_mualai',
    kind: 'luck',
    situation: 'Một công ty nhỏ đang khó khăn rao bán rẻ, có thể là mỏ vàng hoặc cục nợ. Bạn?',
    options: [
      { label: 'Mua lại công ty đó', outcomes: [w(1, pay(2.6, 'Vực dậy thành công, tài sản nhân đôi!')), w(1, pay(0.3, 'Ôm cục nợ, gánh còng lưng.'))] },
      { label: 'Không, rủi ro quá', outcomes: [w(1, pay(1, 'Giữ tiền cho lành.'))] },
    ],
  },
  {
    id: 'l_khuyenmai',
    kind: 'luck',
    situation: 'Đội marketing đề xuất chương trình khuyến mãi sốc, đốt tiền để kéo khách. Bạn?',
    options: [
      { label: 'Duyệt khuyến mãi sốc', outcomes: [w(1, pay(2.4, 'Khách kéo tới ầm ầm, sau đó ở lại luôn!')), w(1, pay(0.4, 'Khách vợt khuyến mãi rồi biến mất, lỗ nặng.'))] },
      { label: 'Khuyến mãi nhẹ nhàng thôi', outcomes: [w(1, pay(1.05, 'Hiệu quả khiêm tốn, an toàn túi tiền.'))] },
    ],
  },
  {
    id: 'l_dauthau',
    kind: 'luck',
    situation: 'Một dự án lớn của chính phủ đang mời thầu, cạnh tranh khốc liệt. Bạn?',
    options: [
      { label: 'Dồn lực đấu thầu', outcomes: [w(1, pay(3, 'Trúng thầu dự án khủng, ăn no cả năm!')), w(1, pay(0.4, 'Trượt thầu, mất công chuẩn bị hồ sơ.'))] },
      { label: 'Bỏ qua kỳ này', outcomes: [w(1, pay(1, 'Không được không mất, để dành sức.'))] },
    ],
  },
  {
    id: 'l_esports',
    kind: 'luck',
    situation: 'Một đội esports mời tài trợ gắn tên thương hiệu, ăn theo hoặc chìm nghỉm. Bạn?',
    options: [
      { label: 'Tài trợ đội tuyển', outcomes: [w(1, pay(2.5, 'Đội vô địch, logo bạn lên sóng khắp nơi!')), w(1, pay(0.4, 'Đội thua bét bảng, tiền tài trợ đổ sông.'))] },
      { label: 'Chưa phải lúc', outcomes: [w(1, pay(1, 'Giữ ngân sách cho việc chắc chắn.'))] },
    ],
  },
  {
    id: 'l_thuebao',
    kind: 'luck',
    situation: 'Đề xuất chuyển sang mô hình thu phí thuê bao thay vì bán đứt. Bạn?',
    options: [
      { label: 'Thử mô hình thuê bao', outcomes: [w(1, pay(2.6, 'Khách gắn bó dài hạn, dòng tiền đều như vắt chanh!')), w(1, pay(0.4, 'Khách quen mua đứt bỏ đi, doanh thu hụt.'))] },
      { label: 'Giữ cách bán cũ', outcomes: [w(1, pay(1, 'Quen thuộc, an toàn.'))] },
    ],
  },
  {
    id: 'l_nhuongquyen',
    kind: 'luck',
    situation: 'Có nơi muốn mua nhượng quyền thương hiệu bạn ra nước ngoài. Bạn?',
    options: [
      { label: 'Ký nhượng quyền quốc tế', outcomes: [w(1, pay(2.8, 'Thương hiệu vươn tầm thế giới, tiền bản quyền chảy về!')), w(1, pay(0.35, 'Đối tác làm ẩu, bôi xấu thương hiệu, phải kiện.'))] },
      { label: 'Giữ trong nước cho chắc', outcomes: [w(1, pay(1, 'Kiểm soát được, không lo mất hình ảnh.'))] },
    ],
  },
  {
    id: 'l_ceothue',
    kind: 'luck',
    situation: 'Một CEO thuê ngoài đầy tham vọng muốn cầm lái mảng mới. Bạn?',
    options: [
      { label: 'Trao quyền cho CEO đó', outcomes: [w(1, pay(2.5, 'CEO có tài, mảng mới lãi đậm!')), w(1, pay(0.4, 'CEO chém gió, đốt tiền rồi nghỉ.'))] },
      { label: 'Tự mình quản', outcomes: [w(1, pay(1.05, 'Vất hơn nhưng nắm chắc.'))] },
    ],
  },
  {
    id: 'r_thautom',
    kind: 'risk',
    situation: 'Đối thủ suy yếu. Bạn có thể vay cực lớn thâu tóm họ, hoặc chờ.',
    options: [
      { label: 'Chờ thời, giữ an toàn', outcomes: [w(1, pay(0.9, 'Không nuốt được ai nhưng công ty vững.'))] },
      { label: 'Vay lớn thâu tóm ngay', risky: true, outcomes: [w(38, pay(4, 'Nuốt trọn đối thủ, thành ông trùm ngành!')), w(47, pay(0.2, 'Vay quá tay, hụt hơi nhưng gượng được.')), w(15, demote('nhanvien', 'Thâu tóm thất bại, nợ đè sập công ty. Mất ghế Chủ tịch.'))] },
    ],
  },
  {
    id: 'r_traiphieu',
    kind: 'risk',
    situation: 'Ngân hàng gợi ý phát hành trái phiếu lãi cao để gọi vốn nhanh. Bạn?',
    options: [
      { label: 'Gọi vốn cách an toàn', outcomes: [w(1, pay(0.9, 'Chậm mà chắc, không nợ nần.'))] },
      { label: 'Phát hành trái phiếu rủi ro cao', risky: true, outcomes: [w(40, pay(3.5, 'Vốn về ào ạt, bung lụa mở rộng!')), w(45, pay(0.25, 'Không trả nổi lãi, lao đao.')), w(15, demote('giamdoc', 'Vỡ nợ trái phiếu, nhà đầu tư kiện, bạn bị cách chức.'))] },
    ],
  },
  {
    id: 'r_ngoaite',
    kind: 'risk',
    situation: 'Tỷ giá đang biến động mạnh. Bạn có thể đầu cơ kiếm đậm, hoặc thủ.',
    options: [
      { label: 'Không đầu cơ, làm ăn thật', outcomes: [w(1, pay(0.95, 'Ngủ ngon, không tim đập chân run.'))] },
      { label: 'Đầu cơ ngoại tệ', risky: true, outcomes: [w(37, pay(4, 'Đoán đúng chiều, lời một vố khổng lồ!')), w(43, pay(0.2, 'Tỷ giá quay xe, cháy tài khoản gần hết.')), w(20, demote('nhanvien', 'Đòn bẩy quá đà, công ty phá sản. Về làm nhân viên.'))] },
    ],
  },
  {
    id: 'r_bdskhonglo',
    kind: 'risk',
    situation: 'Một đại dự án bất động sản cần dốc toàn bộ vốn. Được ăn cả.',
    options: [
      { label: 'Đầu tư một phần vừa phải', outcomes: [w(1, pay(0.9, 'Vào ít cho an toàn, lời khiêm tốn.'))] },
      { label: 'Dốc hết vốn vào dự án', risky: true, outcomes: [w(33, pay(4.5, 'Dự án bùng nổ, bạn thành đại gia bất động sản!')), w(42, pay(0.2, 'Thị trường đóng băng, vốn kẹt cứng.')), w(25, demote('chayvat', 'Dự án sập, mất trắng tất cả. Về vạch xuất phát.'))] },
    ],
  },
  {
    id: 'r_kien',
    kind: 'risk',
    situation: 'Bạn có thể kiện đối thủ vi phạm bản quyền, thắng thì bồi thường lớn, thua thì tốn phí.',
    options: [
      { label: 'Dàn xếp êm đẹp', outcomes: [w(1, pay(0.95, 'Hòa giải nhẹ nhàng, không ồn ào.'))] },
      { label: 'Theo kiện tới cùng', risky: true, outcomes: [w(40, pay(3.5, 'Thắng kiện, ôm về khoản bồi thường béo bở!')), w(48, pay(0.3, 'Thua kiện, gánh án phí, mất mặt.')), w(12, demote('giamdoc', 'Kiện phản đòn, bạn thành bên có lỗi, hội đồng phế truất.'))] },
    ],
  },
  {
    id: 'r_margin',
    kind: 'risk',
    situation: 'Môi giới rủ chơi lớn với đòn bẩy margin trên thị trường chứng khoán. Bạn?',
    options: [
      { label: 'Không chơi đòn bẩy', outcomes: [w(1, pay(0.95, 'Đầu tư đàng hoàng, không cháy tài khoản.'))] },
      { label: 'Full margin đánh lớn', risky: true, outcomes: [w(35, pay(4.5, 'Cổ phiếu bay cao, x mấy lần tài khoản!')), w(40, pay(0.15, 'Call margin, bán tháo, còn cái nịt.')), w(25, demote('nhanvien', 'Cháy sạch tài khoản công ty, phá sản, mất chức.'))] },
    ],
  },
  {
    id: 'r_sapnhapnguoc',
    kind: 'risk',
    situation: 'Một tập đoàn lớn hơn đề nghị sáp nhập ngược, thắng thì lớn mạnh, thua thì mất kiểm soát.',
    options: [
      { label: 'Giữ độc lập', outcomes: [w(1, pay(0.9, 'Vẫn tự làm chủ, không phụ thuộc ai.'))] },
      { label: 'Đặt cược vào thương vụ sáp nhập', risky: true, outcomes: [w(32, pay(5, 'Sáp nhập thành công, đế chế mới ra đời!')), w(43, pay(0.2, 'Đàm phán bế tắc, công ty rệu rã.')), w(25, demote('chayvat', 'Sáp nhập tan vỡ thảm hại, mất tất cả. Làm lại từ đầu.'))] },
    ],
  },
  {
    id: 'r_banthan',
    kind: 'risk',
    situation: 'Bạn thân mở startup, mời bạn đổ hết vốn vào cùng làm ăn. Bạn?',
    options: [
      { label: 'Góp một ít ủng hộ', outcomes: [w(1, pay(0.95, 'Giữ tình bạn, không mạo hiểm tất tay.'))] },
      { label: 'Dốc hết vốn theo bạn thân', risky: true, outcomes: [w(35, pay(4, 'Startup của bạn thân thành kỳ lân, cùng nhau giàu!')), w(40, pay(0.2, 'Startup sập, tình tiền đều mất.')), w(25, demote('nhanvien', 'Cháy sạch vốn, cả công ty lẫn tình bạn tan, mất chức.'))] },
    ],
  },
  {
    id: 'r_thantoc',
    kind: 'risk',
    situation: 'Có thể mở rộng thần tốc ra 10 thị trường cùng lúc, hoặc đi từng bước.',
    options: [
      { label: 'Mở rộng từ từ, chắc chân', outcomes: [w(1, pay(0.9, 'Chậm nhưng vững, không hụt hơi.'))] },
      { label: 'Bung ra 10 thị trường một lúc', risky: true, outcomes: [w(33, pay(4.5, 'Phủ sóng thần tốc, thống trị khu vực!')), w(42, pay(0.2, 'Dàn trải quá mỏng, kiệt vốn.')), w(25, demote('giamdoc', 'Bành trướng vỡ trận, co cụm, bạn bị giáng chức.'))] },
    ],
  },
  {
    id: 'r_crypto',
    kind: 'risk',
    situation: 'Thị trường tiền số lại sôi sục. Quỹ mạo hiểm rủ all-in lần nữa. Bạn?',
    options: [
      { label: 'Không đụng tiền số', outcomes: [w(1, pay(0.95, 'Đứng ngoài, ngủ ngon.'))] },
      { label: 'All-in tiền số', risky: true, outcomes: [w(33, pay(5, 'Trúng đỉnh sóng, x5 tài khoản công ty!')), w(37, pay(0.1, 'Đu đỉnh, cháy gần sạch.')), w(30, demote('nhanvien', 'Cháy tài khoản, công ty phá sản, về làm nhân viên quèn.'))] },
    ],
  },
  {
    id: 'r_xahoiden',
    kind: 'risk',
    situation: 'Một đối tác mờ ám hứa lợi nhuận khủng nếu hợp tác. Nghe là thấy nguy. Bạn?',
    options: [
      { label: 'Từ chối thẳng', outcomes: [w(1, pay(0.95, 'Làm ăn sạch, ngủ không giật mình.'))] },
      { label: 'Bắt tay đối tác mờ ám', risky: true, outcomes: [w(30, pay(4.5, 'Vụ làm ăn trót lọt, tiền về như nước!')), w(35, pay(0.2, 'Bị lật kèo, mất sạch tiền góp.')), w(35, demote('chayvat', 'Dính phốt, công ty tan nát, bạn mất tất cả và mất ghế.'))] },
    ],
  },
  {
    id: 'r_ipongoai',
    kind: 'risk',
    situation: 'Ngân hàng đầu tư khuyên đưa công ty IPO ở sàn nước ngoài lúc thị trường đầy sóng gió.',
    options: [
      { label: 'Hoãn, chờ thị trường ổn', outcomes: [w(1, pay(0.9, 'An toàn qua sóng, chưa vội.'))] },
      { label: 'IPO nước ngoài ngay', risky: true, outcomes: [w(36, pay(4.5, 'Cổ phiếu bốc đầu, bạn thành huyền thoại!')), w(44, pay(0.25, 'Giá lao dốc ngày đầu, nhà đầu tư la ó.')), w(20, demote('giamdoc', 'IPO thảm họa, hội đồng quản trị phế truất bạn.'))] },
    ],
  },
  {
    id: 'r_vaytraluong',
    kind: 'risk',
    situation: 'Khủng hoảng ập tới, phải vay nặng lãi mới đủ trả lương giữ người. Bạn?',
    options: [
      { label: 'Thu hẹp, cắt giảm bớt', outcomes: [w(1, pay(0.85, 'Đau nhưng sống, giữ được phần cốt lõi.'))] },
      { label: 'Vay nặng lãi cầm cự toàn bộ', risky: true, outcomes: [w(38, pay(3.5, 'Vượt bão, giữ nguyên đội hình, bật dậy mạnh mẽ!')), w(42, pay(0.2, 'Lãi mẹ đẻ lãi con, càng gồng càng đuối.')), w(20, demote('nhanvien', 'Không gồng nổi lãi, công ty phá sản, mất chức.'))] },
    ],
  },
  {
    id: 'r_marketingtoancau',
    kind: 'risk',
    situation: 'Đội marketing xin tất tay một chiến dịch toàn cầu, được thì nổi khắp thế giới.',
    options: [
      { label: 'Chạy thử quy mô nhỏ trước', outcomes: [w(1, pay(0.9, 'Thăm dò an toàn, hiệu quả vừa phải.'))] },
      { label: 'Tất tay chiến dịch toàn cầu', risky: true, outcomes: [w(35, pay(4, 'Cả thế giới biết đến bạn, đơn hàng đổ về!')), w(43, pay(0.2, 'Thông điệp lạc quẻ, đốt ngân sách vô ích.')), w(22, demote('giamdoc', 'Chiến dịch phản tác dụng nặng, hội đồng cách chức.'))] },
    ],
  },
  {
    id: 'r_codongchiphoi',
    kind: 'risk',
    situation: 'Một nhà đầu tư mờ ám rót vốn khủng, đổi lại muốn nắm cổ phần chi phối. Bạn?',
    options: [
      { label: 'Từ chối, giữ quyền kiểm soát', outcomes: [w(1, pay(0.9, 'Vẫn là ông chủ thực sự.'))] },
      { label: 'Nhận vốn, nhường cổ phần chi phối', risky: true, outcomes: [w(33, pay(4, 'Vốn khủng giúp bay cao, cùng thắng lớn!')), w(37, pay(0.3, 'Bị thâu tóm ngược, mất tiếng nói.')), w(30, demote('chayvat', 'Nhà đầu tư lật kèo, hất bạn khỏi công ty. Trắng tay.'))] },
    ],
  },
  {
    id: 'r_dautunuocngoai',
    kind: 'risk',
    situation: 'Cơ hội đầu tư nhà máy ở nước ngoài, lời to nhưng rủi ro pháp lý và tỷ giá. Bạn?',
    options: [
      { label: 'Đầu tư dè dặt, thăm dò', outcomes: [w(1, pay(0.9, 'Bỏ ít vốn, an toàn là chính.'))] },
      { label: 'Rót vốn lớn xây nhà máy', risky: true, outcomes: [w(36, pay(4, 'Nhà máy vận hành trơn tru, lời đậm dài hạn!')), w(44, pay(0.2, 'Vướng thủ tục, đội vốn, kẹt tiền.')), w(20, demote('nhanvien', 'Dự án đổ bể vì rủi ro pháp lý, phá sản, mất chức.'))] },
    ],
  },
];
