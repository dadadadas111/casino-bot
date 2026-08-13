export interface PatchNote {
  version: string;
  date: string; // dd/MM/yyyy
  title: string;
  changes: string[];
}

/** Newest first. Bumping the top entry makes the bot announce it on boot. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '2.6.0',
    date: '13/08/2026',
    title: 'Admin cũng phải sợ pháp luật',
    changes: [
      '🚨 **Cheat là có ngày bị tóm**: mỗi lần admin cộng/trừ/đặt xu đều có **35%** bị cảnh sát đột kích. Bị bắt thì giao dịch hủy sạch, admin vào tù như thường dân, cả server được xem',
      '⛓️ Đang ngồi tù thì `/casino-admin` cũng bị khóa luôn, khỏi sửa sổ sách từ sau song sắt',
    ],
  },
  {
    version: '2.5.0',
    date: '13/08/2026',
    title: 'Hồ sơ cá nhân',
    changes: [
      '📋 **`/hoso [nguoi]`**: xem trọn đời một người chơi. Tài sản, thành tích từng trò (kèm cú thắng đậm nhất), số lần đi tù, số lần nhập viện, trộm được mấy vố và bị trộm mấy lần, vé số đã mua, cưới ai từ bao giờ, túi đồ đang có',
      '-# `/sodu` vẫn giữ nguyên cho ai chỉ muốn liếc nhanh cái ví.',
    ],
  },
  {
    version: '2.4.0',
    date: '13/08/2026',
    title: 'Đội mũ vào rồi hãy cầm súng',
    changes: [
      '🪖 **Mũ bảo hiểm** (1.000 xu): trúng đạn cò quay Nga vẫn khỏi nhập viện, mũ vỡ sau một lần đỡ đạn',
      '🏷️ **Toàn bộ shop giảm giá**, không món nào quá 1.000 xu: khiên 800, cà phê 300, chìa khóa 200, hộp quà 500',
      '🗝️ Chìa khóa vạn năng giờ dùng được cho cả trốn viện, không chỉ vượt ngục',
      '⏱️ Ngồi tù còn 5 phút, nằm viện 3 phút 36 giây',
      '💸 **Phí chuộc thân lũy tiến**: lần đầu 1.000 xu, tái phạm trong ngày thì nhân đôi nhân ba, reset sau 24 giờ. Chơi liều nhiều lần là cháy ví',
    ],
  },
  {
    version: '2.3.0',
    date: '13/08/2026',
    title: 'Cò quay Nga và bệnh viện',
    changes: [
      '🔫 **`/coquay cuoc`**: cò quay Nga từ 2 người trở lên, góp cược bằng nhau, thay phiên bóp cò. Ai dính đạn mất sạch cược, người sống chia nhau',
      '🏥 **Bệnh viện**: trúng đạn thì nằm viện 3 phút 36 giây, cấm chơi bời. `/vienphi` 100 xu để xuất viện sớm',
      '⛓️ Ngồi tù rút còn 5 phút, nộp phạt cũng chỉ 100 xu',
      '✏️ **`/doiten`**: admin đổi được tên hiển thị của bot trong server',
      '⚡ Reset ghế nóng Triệu Phú giảm còn **500đ**',
      '⚖️ Bỏ `/casino-admin resetcd`: giờ đã có nạp tiền thì admin reset chùa là không công bằng',
    ],
  },
  {
    version: '2.2.0',
    date: '13/08/2026',
    title: 'Triệu phú đúng nghĩa triệu phú',
    changes: [
      '💰 **Thang thưởng Triệu Phú tăng mạnh**: phá đảo 15 câu ăn **100.000 xu** (cũ 15.000), mốc an toàn câu 5 là 5.000 và câu 10 là 25.000',
      '⏱️ Mỗi câu chỉ còn **30 giây**, nghĩ lâu quá là mất lượt',
      '💱 Đổi tiền nạp sang xu giờ **1đ ăn 20 xu**, gấp đôi tỉ lệ cũ',
    ],
  },
  {
    version: '2.1.1',
    date: '13/08/2026',
    title: 'Sửa vặt sau ngày ra mắt',
    changes: [
      '💵 Nạp tiền xong bot báo ngay tại kênh bạn gõ `/nap`, không còn im lặng khi tài khoản chặn tin nhắn riêng',
      '🥢 **Tiệc cưới**: thêm nút **Ăn chực** cho khách rỗng túi, cuối tiệc bot đọc sổ ghi lễ và bêu tên ai tới ăn chùa',
    ],
  },
  {
    version: '2.1.0',
    date: '13/08/2026',
    title: 'Đổi tiền lấy xu',
    changes: [
      '💱 **`/cash doixu`**: đổi tiền nạp sang xu, 1đ ăn 10 xu (10.000đ = 100.000 xu)',
      '💵 **`/nap`**: tối thiểu 10.000đ mỗi lần, theo quy định của MB Bank',
      '-# Vẫn một chiều: xu không đổi ngược lại thành tiền thật được đâu nhé.',
    ],
  },
  {
    version: '2.0.0',
    date: '13/08/2026',
    title: 'Sòng bạc lên đời thành khu phố',
    changes: [
      '🏦 **Ngân hàng**: `/bank gui|rut` cất tiền vào két, trộm hết đường mò',
      '🦹 **Trộm cắp & nhà tù**: `/trom` ăn 40%, trượt là bóc lịch 30 phút, `/nopphat` chuộc thân',
      '🛒 **Cửa hàng**: `/shop` `/mua` `/dungdo` với khiên chống trộm, bùa may mắn +10% tiền lời, cà phê xóa cooldown, chìa khóa vượt ngục',
      '💒 **Yêu đương**: `/cauhon` (nhớ mua nhẫn), `/honle` mở tiệc cho cả kênh mừng tiền, `/lyhon` khi hết duyên',
      '💵 **Nạp tiền**: `/nap` quét QR chuyển khoản, dùng để reset ghế nóng Triệu Phú ngay lập tức',
      '📖 **/help mới**: chia 5 trang bấm nút, đỡ rối mắt',
      '⚖️ **Cân bằng**: admin chỉ cộng tối đa 10.000 xu/lần, số dư trên 100.000 đã được san phẳng',
    ],
  },
];

export const LATEST_PATCH = PATCH_NOTES[0];
