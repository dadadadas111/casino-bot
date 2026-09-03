export interface PatchNote {
  version: string;
  date: string; // dd/MM/yyyy
  title: string;
  changes: string[];
}

/** Newest first. Bumping the top entry makes the bot announce it on boot. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '5.11.0',
    date: '03/09/2026',
    title: 'Mỗi server có item và đồ sưu tầm riêng',
    changes: [
      '🎁 **Admin server tự tạo item riêng bằng `/quanly`.** Đồ sưu tầm hoặc đồ có hiệu ứng (xóa cooldown làm việc, thoát tù/viện, buff may mắn), tự đặt giá, độ hiếm, và **gắn role Discord tặng khi sở hữu**',
      '🛒 **`/cuahang`: mua item riêng của server**, tự nhận role, dùng được đồ hiệu ứng',
      '🏅 **`/suutap`: khoe bộ sưu tập và bảng xếp hạng sưu tầm** của server (điểm tính theo độ hiếm)',
      '-# Ví xu vẫn dùng chung mọi server. Item riêng chỉ mua và dùng trong chính server tạo ra nó, nên mỗi cộng đồng có bộ sưu tập của riêng mình.',
    ],
  },
  {
    version: '5.10.0',
    date: '24/08/2026',
    title: 'Triệu Phú: thắng lớn thì nghỉ dài hơn',
    changes: [
      '🎰 **Ván Triệu Phú nào ẵm từ 30.000 xu trở lên giờ khóa ghế nóng 1 tiếng** (gồm cả về đích 100k, và cả khi dừng non ở câu cao). Chơi thường hoặc thua nhỏ thì vẫn 15 phút như cũ',
      '⌨️ **Bỏ lệnh gõ tay kiểu `!tx`.** Từ giờ dùng dấu `/` cho mọi lệnh — gõ `/` là Discord gợi ý đầy đủ, gọn hơn và không đụng tiền tố của bot khác',
      '-# Cooldown dài chỉ chạm những ai thắng lớn liên tục, người chơi vui vẻ gần như không thấy khác gì.',
    ],
  },
  {
    version: '5.9.0',
    date: '21/08/2026',
    title: 'Nhiệm vụ nho nhỏ để làm',
    changes: [
      '🎯 **`/nhiemvu`: luôn có một nhiệm vụ đang chờ.** Kiểu "thắng một ván Blackjack", "đi làm 2 ca", "tặng quà cho ai đó", "trộm thành công một lần". Tiến độ tự đếm khi bạn chơi, xong thì bấm nhận thưởng',
      '🔄 **Không thích thì đổi.** 10 phút sau khi mở bảng nhiệm vụ là được đổi sang cái khác',
      '-# Thưởng nhỏ (600-2.000 xu) nên không đè các trò chính, chủ yếu để có việc vặt mà làm và thử những trò ít đụng tới.',
    ],
  },
  {
    version: '5.8.0',
    date: '21/08/2026',
    title: 'Không biết làm gì thì hỏi /recommend',
    changes: [
      '🧭 **`/recommend` gợi ý nên làm gì tiếp theo** dựa trên tình trạng hiện tại: đang ở tù/viện thì nhắc chuộc thân, ví nhiều tiền thì nhắc cất két, chưa điểm danh hay tới lượt làm việc / Triệu Phú thì nhắc chơi luôn',
      '-# Xem hộ người khác được: `/recommend nguoi:@ai đó`.',
    ],
  },
  {
    version: '5.7.0',
    date: '21/08/2026',
    title: 'Câu hỏi Triệu Phú chất lượng hơn',
    changes: [
      '🧠 **Lọc câu hỏi kém.** Trước đây thỉnh thoảng có câu nhiều đáp án cùng đúng (kiểu "con nào là bò sát" mà có cả rùa lẫn thằn lằn) hoặc câu chủ quan không có đáp án chuẩn. Giờ mỗi câu mới đều qua một vòng kiểm định trước khi vào kho',
      '-# Đã dọn lại cả kho câu hỏi hiện có, bỏ các câu mơ hồ hoặc gây tranh cãi.',
    ],
  },
  {
    version: '5.6.0',
    date: '21/08/2026',
    title: 'Ai Là Triệu Phú chơi thả ga hơn',
    changes: [
      '💰 **Triệu Phú giờ chơi lại sau mỗi 15 phút**, không còn giới hạn một lần mỗi ngày. Cứ hết cooldown là lại lên ghế nóng',
      '🏆 **Giải thưởng tối đa nâng lên 100.000 xu** (mốc an toàn 6.000 ở câu 5 và 30.000 ở câu 10)',
      '-# Tạm bỏ trả tiền để chơi lại ngay, giờ chỉ cần chờ 15 phút là được.',
    ],
  },
  {
    version: '5.5.0',
    date: '20/08/2026',
    title: 'Mua cả rổ, và công việc hợp chức hơn',
    changes: [
      '🧺 **Mua nhiều món một lúc.** Trong `/tuido` bấm nút Mua nhiều để nhập số lượng, hoặc gõ thẳng `!mua mubaohiem 3`. Mua nhiều hộp quà thì mở hết một lượt, cộng dồn tiền trúng',
      '💼 **Công việc giờ hợp với chức.** Chủ tịch không còn đi rửa chén thuê nữa mà chủ trì hội đồng quản trị, ký thương vụ triệu đô; Chạy vặt thì lau máy xèng, bưng nước. Mỗi cấp một kiểu việc',
    ],
  },
  {
    version: '5.4.0',
    date: '20/08/2026',
    title: 'Ghế Chủ tịch không dễ ngồi',
    changes: [
      '🏦 **Lên chức Chủ tịch rồi thì đi làm không còn nhàn.** Một nửa số ca sẽ là một quyết định điều hành công ty: giữ người tài, ký hợp đồng, xử lý khủng hoảng truyền thông...',
      '📈 **Chọn đúng thì ăn đậm** (có ca nhân tới 5 lần lương), chọn sai thì lỗ, và vài tình huống hoàn toàn hên xui',
      '💥 **Có nút liều dẫn tới phá sản.** Vay lớn đánh úp, all-in tiền số, IPO ẩu... trúng thì phất to, xui thì mất ghế Chủ tịch, rơi xuống chức thấp và cày lại. Nút liều luôn ghi rõ % phá sản nên không ai mất chức oan',
      '-# Quyết định nào cũng cho rút lui an toàn. Muốn ngồi yên hưởng lương đều thì cứ chọn cửa chắc, không ai ép liều.',
    ],
  },
  {
    version: '5.3.0',
    date: '20/08/2026',
    title: 'Uống cà phê quá đà thì đi viện',
    changes: [
      '☕💀 **Cà phê giờ có thể gây ngộ độc.** Ba ly một giờ thì vô tư, nhưng ly thứ tư trở đi có nguy cơ tim đập loạn xạ và ngất xỉu vào viện, nguy cơ tăng dần mỗi ly (20%, 40%, 60%...). Ai spam cà phê để cày liên tục thì coi chừng',
      '-# Uống điều độ thì không bao giờ dính. Bot có nhắc nguy cơ trước mỗi ly từ ly thứ tư.',
      '🎱 **Hũ xổ số giờ luôn mở lại ở 1.000.000 xu** sau mỗi lần có người trúng, thay vì tụt về mức nhỏ. Luôn có một triệu treo đó cho người mua vé kế tiếp',
      '💸 **Thuế thu nhập nhẹ đi nhiều.** Cày một buổi tối giờ không còn bị đánh thuế nữa, thuế chỉ chạm mức mà bình thường không ai với tới',
    ],
  },
  {
    version: '5.2.0',
    date: '19/08/2026',
    title: 'Sảnh sòng bạc, khỏi lục lệnh gạch chéo',
    changes: [
      '🎰 **`/sanh` mở một bảng nút cho cả sòng bạc.** Ghim tin nhắn đó vào kênh là xong: từ đó bấm nút mà chơi, không phải gõ `/` rồi lạc trong danh sách lệnh của mấy chục app khác nữa',
      '-# Nút sống mãi, bot restart cũng không hỏng. Trò nào cần tiền cược thì bấm vào hiện ô nhập, gõ được cả `1k`, `all`, `half`.',
      '⌨️ **Gõ mỗi dấu prefix là mở bảng đó.** Mặc định là `!`, tức là gõ đúng một ký tự `!` rồi Enter',
      '🔤 **Gõ sai tên lệnh thì bot đoán hộ.** `!dail` sẽ được hỏi lại có phải ý bạn là `!daily` không. Gõ chữ chẳng liên quan thì bot vẫn im, để không giẫm chân các bot khác cùng dùng dấu `!`',
      '-# Lệnh nhắn tin không bao giờ có gợi ý tự động được, đó là giới hạn của Discord chứ không phải bot làm thiếu. Hai thứ trên là cách bù lại.',
    ],
  },
  {
    version: '5.1.0',
    date: '19/08/2026',
    title: 'Cao hay Thấp, Dò mìn, và dọn hai trò ế',
    changes: [
      '🃏 **`/hilo` Cao hay Thấp.** Lật một lá bài, đoán lá kế tiếp cao hơn hay thấp hơn. Đoán đúng thì tiền nhân lên, đoán tiếp hay rút là tùy bạn, nhưng sai một lá là mất sạch',
      '-# Tỷ lệ ăn tính theo đúng lá đang nằm trên bàn: con 2 mà đoán thấp hơn thì ăn x11,64, còn đoán cao hơn chỉ x1,06. Tối đa 8 lá.',
      '💣 **`/domin` Dò mìn.** Ba quả mìn giấu trong mười sáu ô. Mở được ô nào ăn ô đó, mở càng nhiều tiền càng dày, nhưng bấm trúng mìn là trắng tay. Dọn sạch cả bãi ăn x537',
      '-# Cả hai trò đều cho rút giữa chừng. Cái khó là biết dừng lúc nào.',
      '🗑️ **Bỏ `/keo` và `/coinflip`.** Kèo tung xu cả đời bot mới có 14 ván và không ai đụng tới từ ngày 15/08. Tung đồng xu thì không có lấy một quyết định nào, Cao hay Thấp làm đúng việc đó nhưng hay hơn',
      '-# Gõ `!cf` bây giờ bot sẽ chỉ bạn sang `/hilo`. Bầu cua tuy ít ván nhưng có tới 11 người từng chơi nên vẫn giữ.',
    ],
  },
  {
    version: '5.0.0',
    date: '19/08/2026',
    title: 'Nhà cửa, sự nghiệp và nợ nần',
    changes: [
      '💼 **Đi làm giờ có chức.** `/lamviec` không còn phẳng lì 200-500 xu nữa. Làm càng nhiều ca càng lên chức, từ 🧹 Chạy vặt tới 🏦 Chủ tịch, lương đỉnh 2.000-3.500 mỗi ca. Số ca bạn đã làm từ trước vẫn được tính, không mất công ai cả',
      '🏠 **Nhà, xe, thú cưng** trong thẻ mới của `/tuido`. Nhà cộng tiền điểm danh tới +100%, xe rút thời gian chờ làm việc từ 10 phút xuống 4, 🐶 chó đuổi trộm, 🐱 mèo tha xu về mỗi ngày, 🦜 vẹt cho thêm một lượt 50:50 ở Triệu Phú',
      '-# Mỗi loại giữ một món, lên đời thì món cũ được thu lại nửa giá. Giá từ 20.000 tới 1.500.000 xu, đủ chỗ cho đống xu nằm không trong két.',
      '💰 **Vay nóng** bằng nút trong `/vi`. Hạn mức tuỳ uy tín: chức càng cao, tài sản càng nhiều thì vay được càng lớn. Lãi 20% cho 24 giờ, quá hạn mỗi giờ cộng thêm 5%',
      '🚨 **Quỵt nợ thì bị siết.** Quá hạn một ngày là chủ nợ vét ví, phá két, tịch thu nhà xe bán nửa giá, vẫn thiếu thì tống vào tù 15 phút kèm bêu tên giữa kênh',
      '🧾 **`/doino @ai đó`** để đi dí nợ người khác. Không lấy được xu nào, nhưng càng đòi nhiều lần bot càng làm ầm ĩ, tới lần thứ mười thì dựng rạp đọc loa. Con nợ bị dí thì phải cày thêm ca nên lương tạm +10%',
      '🎱 Hũ xổ số giờ tự lớn: mọi khoản lãi bot thu về đều dồn hết vào hũ rồi trả lại cho người chơi qua giải thưởng',
    ],
  },
  {
    version: '4.1.0',
    date: '18/08/2026',
    title: 'Máy xèng dễ thở, hũ xổ số phình to',
    changes: [
      '🎰 **Máy xèng giờ trả tiền thật khi ra hai hình cao.** Đôi 🔔 ⭐ 💎 7️⃣ ăn x2 chứ không chỉ hoàn vốn nữa. Số ván có lãi nhảy từ 1,6% lên 18%, tức là cứ khoảng 5 lượt là có một lượt ăn tiền',
      '-# Đôi hình thường (🍒🍋🍇🍊) vẫn hoàn lại tiền cược. Ba hình giống nhau ăn từ x10 tới x100, 7️⃣7️⃣7️⃣ vẫn là x100.',
      '🎱 **Hũ xổ số được bơm lên 1.000.000 xu.** Vé vẫn 100 xu, chọn số 00-99, quay 21h mỗi tối. Ai trúng ẵm cả hũ, nhiều người trúng thì chia đều',
      '-# Sau khi có người trúng, hũ về mốc 50.000 xu rồi lại dồn lên (trước đây tụt về 5.000 nên chẳng ai buồn mua vé).',
    ],
  },
  {
    version: '4.0.0',
    date: '18/08/2026',
    title: 'Dọn lại toàn bộ danh sách lệnh',
    changes: [
      '🧹 **Từ 53 lệnh xuống còn 33.** Các lệnh nhỏ cùng chủ đề gom vào một bảng có nút, không còn lệnh con lồng nhau',
      '👛 **`/vi`** thay cho `/bank` `/cash` `/lichsu`: ví, két và tiền nạp chung một bảng, bấm nút để gửi két, rút két, đổi ra xu, xem lịch sử. Nhập số hiểu cả `1k`, `all`, `half`',
      '🎒 **`/tuido`** thay cho `/shop` `/mua` `/dungdo` `/tang`: đổi qua lại hai thẻ Túi đồ và Cửa hàng, chọn món rồi Mua, Dùng hoặc Tặng',
      '💍 **`/cuoi`** thay cho `/cauhon` `/lyhon` `/honle`: có tên người là cầu hôn luôn, bỏ trống thì mở bảng gia đình',
      '🎎 **`/hinhnom`** giờ là một bảng nút, không phải nhớ `tao` `xem` `doiten` `cuoi` `bo` nữa. Đổi cả tên lẫn hình vẫn chỉ tốn một 🏷️ Thẻ đổi tên',
      '🔓 **Bỏ `/nopphat` và `/vienphi`.** Đang ở tù hay nằm viện thì nút chuộc thân nằm ngay trong tin nhắn chặn bạn, khỏi phải nhớ tên lệnh',
      '⚙️ **`/caidat`** gom hết phần của admin server: bản tin, thông báo cập nhật, prefix, tên bot',
      '🛡️ **Admin server không còn thấy các lệnh chỉnh xu nữa.** Trước đây `/casino-admin`, `/luck`, `/backup`, `/duyetcau` vẫn hiện trong danh sách của mọi server dù bấm vào là bị từ chối. Xu dùng chung cho mọi server nên chỉ chủ bot chỉnh được, giờ mấy lệnh đó biến khỏi danh sách luôn cho đỡ gây hiểu nhầm',
      '🎫 `/xoso so:42` mua vé thẳng, bỏ trống `so` thì xem jackpot',
      '-# `/sodu` và `/shop` vẫn dùng được, chúng mở thẳng vào bảng tương ứng. Các lệnh gõ tắt `!tx` `!bc` `!cf` `!sl` `!dn` `!xs` `!work` không đổi gì.',
    ],
  },
  {
    version: '3.1.0',
    date: '18/08/2026',
    title: 'Câu hỏi hết trùng lặp',
    changes: [
      '🔍 Bot giờ nhận ra hai câu hỏi **cùng một ý nhưng khác cách diễn đạt**, không chỉ trùng y hệt. Đã dọn 49 câu trùng khỏi kho',
      '⚖️ Câu nào khó phân định thì để dành cho chủ bot duyệt tay thay vì vứt đi',
      '-# Ví dụ bị bắt: "Loài hoa nào là quốc hoa Việt Nam?" và "Quốc hoa Việt Nam là loài hoa nào?".',
    ],
  },
  {
    version: '3.0.0',
    date: '18/08/2026',
    title: 'Kho câu hỏi dùng chung',
    changes: [
      '💰 **Ai Là Triệu Phú giờ rút câu hỏi từ kho chung** thay vì nhờ AI soạn mới mỗi ván. Bot nhớ server bạn đã gặp câu nào, chỉ đưa câu mới, sắp hết thì tự nạp thêm',
      '⚡ Vào ván **nhanh hơn hẳn**, không còn phải chờ soạn đề',
      '🔕 Bản tin hằng ngày tạm tắt để tiết kiệm chi phí, bật lại bất cứ lúc nào',
      '-# Kho khởi điểm 150 câu, mỗi server chơi được 8 ván trước khi bot tự bổ sung.',
    ],
  },
  {
    version: '2.9.0',
    date: '18/08/2026',
    title: 'Rà soát trước khi phát hành',
    changes: [
      '🛡️ Bị khiên chặn khi đi trộm thì **không còn bị tống vào tù oan** nữa, chỉ mất lượt',
      '🏆 **`/top` giờ chỉ tính người trong server này**, không lẫn người lạ từ server khác',
      '💰 Tiền cược đang dở khi bot cập nhật/restart giờ **được hoàn lại tự động**, không mất trắng',
      '🔒 Chỉnh số dư bằng `/casino-admin` giờ chỉ chủ bot làm được, vì xu dùng chung cho mọi server',
      '🔕 Bản tin hằng ngày **không còn tự ping @everyone**, muốn thì bật bằng `/bantin config`',
      '💒 Tiệc cưới thôi ping cả kênh, đỡ làm phiền người không quan tâm',
    ],
  },
  {
    version: '2.8.0',
    date: '13/08/2026',
    title: 'Hình nộm, thẻ tên và tặng quà',
    changes: [
      '🎎 **Hình nộm** (1.000 xu): tạo người bạn tưởng tượng, tự đặt tên và chọn hình trong 10 kiểu, thích thì `/hinhnom cuoi` luôn. Không cần ai đồng ý, không sợ bị từ chối',
      '🏷️ **Thẻ đổi tên** (200 xu): đổi tên hoặc đổi hình cho hình nộm',
      '🎁 **`/tang nguoi mon`**: tặng đồ trong túi cho người khác, khỏi phải mua hộ',
      '-# Cưới hình nộm vẫn mở tiệc `/honle` bình thường, khách vẫn mừng tiền như thường. Toàn bộ tiền mừng về tay bạn vì hình nộm làm gì có ví.',
    ],
  },
  {
    version: '2.7.0',
    date: '13/08/2026',
    title: 'Cân bằng lại cả sòng',
    changes: [
      '🔨 **Làm việc mỗi 10 phút** thay vì mỗi giờ, tiền công lên **200-500 xu**. Cày cuốc giờ đủ sống, không còn là lệnh vô dụng',
      '💰 **Triệu Phú hạ trần xuống 50.000 xu** (mốc an toàn 3.000 và 15.000). Giải cũ 100.000 mỗi ngày là in tiền quá tay, dễ vỡ kinh tế server',
      '🦹 **Trộm nhẹ tay hơn**: ăn 12% ví nạn nhân, tối đa 5.000 xu. Trước đó cướp lời gấp 20 lần đi làm, giờ chỉ hơn một chút cho đúng chất giang hồ',
      '-# Đã mô phỏng 300.000 ván blackjack: RTP 94,6%, luật chơi không có lỗi. Con số 107% trên bảng chỉ là may rủi của mẫu nhỏ.',
    ],
  },
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
