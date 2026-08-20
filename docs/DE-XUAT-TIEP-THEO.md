# Đề xuất tiếp theo (ghi ngày 19/08/2026)

Chưa làm gì. Tài liệu này để chủ bot quyết một thể.

---

## 1. Câu hỏi: có phải ít người dùng `/daily` không?

Đúng, nhưng nguyên nhân không phải người ta không biết lệnh.

**Số dùng thực tế (9 ngày, tính tới 10h21 ngày 19/08):**

| | |
|---|---|
| Đã từng điểm danh | 12/19 người (63%) |
| Chưa bao giờ điểm danh | 7 người |
| Tổng lượt | 44 |
| Ngày đông nhất | 7 người (37% người chơi) |
| Chuỗi dài nhất đang giữ | 8 ngày (1 người) |
| Số người có chuỗi ≥ 2 | 6 |

Theo ngày: 2, 5, 4, 6, 7, 5, 7, 7, và hôm nay mới 1 (còn sớm, mới 10h sáng).

**Nguyên nhân thật: phần thưởng vô nghĩa về mặt kinh tế.**

| Nguồn tiền sạch vào bot | Xu |
|---|---|
| Lệnh admin (`cong` + `dat`, ròng) | **1.527.190** |
| Điểm danh + làm việc + quà tân thủ | **73.000** |

Cày cuốc chỉ chiếm **4,6%** nguồn tiền. Cụ thể hơn: điểm danh cho 500-1.000 xu/ngày, trong khi **một ván blackjack trung bình cược 3.154 xu**. Tức là điểm danh cả ngày chỉ bằng **16-32% của một ván bài**. Điểm danh liên tục cả tháng (~24.000 xu) vẫn thua 8 ván blackjack.

Không ai bỏ công gõ lệnh mỗi ngày để lấy 1/6 một ván cược. Chuỗi gãy liên tục cũng vì lý do đó: mất chuỗi chẳng thiệt gì.

**Kết luận:** không cần nhắc nhở hay thông báo. Cần làm cho phần thưởng có sức nặng, hoặc gắn nó vào thứ người ta thật sự muốn. Cả hai ý tưởng dưới đây đều làm việc đó.

---

## 2. Nhà, xe, thú cưng

**Vấn đề nó giải:** 1.760.000 trong tổng 1.959.108 xu (90%) đang nằm chết trong két. Shop trần 1.000 xu, mua sạch mọi thứ chưa tới 6.000. Người ta cày xong rồi ngồi nhìn con số.

**Không thêm lệnh mới.** Thêm thẻ thứ ba `🏠 Tài sản` vào `/tuido`, giữ nguyên 33 lệnh.

### Nhà (tăng tiền điểm danh)

| | Giá | Hiệu ứng |
|---|---|---|
| 🏚️ Nhà trọ | 20.000 | Điểm danh +10% |
| 🏠 Nhà phố | 100.000 | +25% |
| 🏡 Biệt thự | 400.000 | +50% |
| 🏰 Lâu đài | 1.500.000 | +100% |

Đây chính là chỗ chữa vấn đề mục 1: có nhà thì điểm danh mới đáng gõ. Lạm phát không đáng lo vì cả đời bot mới phát ra 28.700 xu tiền điểm danh, gấp đôi lên vẫn là hạt cát.

### Xe (giảm cooldown làm việc, đang là 10 phút)

| | Giá | Cooldown |
|---|---|---|
| 🛵 Xe máy | 30.000 | 8 phút |
| 🚗 Ô tô | 150.000 | 6 phút |
| 🏎️ Siêu xe | 600.000 | 4 phút |

### Thú cưng (mỗi người một con)

| | Giá | Hiệu ứng |
|---|---|---|
| 🐶 Chó | 25.000 | 20% chặn trộm, không vỡ như khiên |
| 🐱 Mèo | 25.000 | Mỗi ngày tha về 100-500 xu, nhận cùng lúc điểm danh |
| 🦜 Vẹt | 80.000 | Mách nước 50/50 một lần mỗi ván Triệu Phú |

Mèo cố tình gắn vào `/daily`: muốn nhận thì phải điểm danh.

**Cố ý không làm:** thú cưng cộng % tiền thắng. Bất kỳ hiệu ứng nào cộng thẳng vào tiền thắng sẽ đẩy RTP vượt 100% và biến trò cược thành máy in tiền.

**Khối lượng:** một bảng `user_assets`, một service, một thẻ trong `/tuido`, móc vào daily/work/trộm/triệu phú, hiện trong `/hoso`. Khoảng 400-500 dòng kèm test.

---

## 3. Nghề nghiệp có cấp bậc

**Vấn đề nó giải:** `/lamviec` là lệnh kiếm tiền được dùng nhiều nhất (90 lượt) nhưng phẳng lì 200-500 xu mãi mãi, không có gì để hướng tới.

Lên cấp theo tổng số ca đã làm:

| Ca đã làm | Chức | Lương mỗi ca |
|---|---|---|
| 0-9 | 🧹 Chạy vặt | 200-500 |
| 10-29 | 🔨 Phụ hồ | 350-700 |
| 30-79 | 👔 Nhân viên | 500-1.000 |
| 80-199 | 📊 Trưởng phòng | 800-1.500 |
| 200-499 | 💼 Giám đốc | 1.200-2.200 |
| 500+ | 🏦 Chủ tịch | 2.000-3.500 |

Lên chức thì bot đăng công khai ăn mừng. Chức danh hiện trong `/hoso` và bản tin.

**Chuyện lương cao thì cày ra nhiều xu đã có lời giải ở mục 4 (thuế thu nhập).** Không cần chặn cứng nữa: ai cày càng ghê thì thuế càng ăn, tự nó phanh lấy. Giữ nguyên bảng lương trên, cho xe và chức cộng dồn thoải mái.

**Khối lượng:** một cột `work_count`, sửa nhẹ service, đổi lời nhắn. Khoảng 150 dòng kèm test. Rẻ hơn hẳn mục 2, làm trước cũng được.

---

## 4. Thuế thu nhập ẩn (ý của chủ bot)

**Vấn đề nó giải:** chức cao cộng xe xịn thì cày ra quá nhiều xu. Thay vì chặn cứng bằng cách hạ lương, đánh thuế lũy tiến theo thu nhập, ai cày ghê thì tự bị phanh.

### Tính trên thu nhập 24 giờ gần nhất, chỉ tính tiền công

Bậc thuế áp trên **tổng lương `/lamviec` trong 24h trượt**, không tính tiền thắng bạc và không tính điểm danh.

| Thu nhập 24h | Thuế biên |
|---|---|
| 0 - 40.000 | 0% |
| 40.000 - 100.000 | 15% |
| 100.000 - 250.000 | 35% |
| trên 250.000 | 60% |

> **Đã hiệu chỉnh 20/08/2026.** Bảng cũ (bậc đầu 5.000, trần 80%) đặt cho một thế giới tưởng tượng nơi người cày đỉnh làm 990k/ngày. Thực tế người cày nhiều nhất chỉ tới ~20k/ngày (hơn 6 tiếng gõ `/lamviec`) mà đã dính bậc 25%. Bảng mới cho toàn bộ playerbase hiện tại về 0%, thuế chỉ cắn ở mức không ai chạm bằng tay.

Lũy tiến theo bậc, tức là phần thu nhập nằm trong bậc nào chịu thuế bậc đó, không phải toàn bộ nhảy lên mức cao nhất.

**Cày bình thường thì không mất gì.** Hiện tại trung bình 0,9 ca/người/ngày, tức khoảng 350 xu, nằm gọn trong bậc 0%. Người chơi thường sẽ không bao giờ biết cơ chế này tồn tại.

**Người cày ghê thì thấm dần:**

| Kiểu chơi | Lương gộp/ngày | Thực nhận | Thuế thực tế |
|---|---|---|---|
| Thường (3 ca) | ~1.000 | 1.000 | 0% |
| Chăm (15 ca, chức Nhân viên) | ~11.000 | 10.400 | 5% |
| Cày (30 ca, chức Chủ tịch) | ~82.500 | 56.100 | 32% |
| Cày trâu (cả ngày, Chủ tịch + Siêu xe) | ~990.000 | ~305.000 | 69% |

Cửa sổ 24h là trượt, nên nghỉ vài tiếng là thuế tự hạ xuống.

### Tiền thuế đi đâu: vào hũ xổ số

Đây là chỗ đáng làm nhất. Thay vì hủy tiền cho biến mất, dồn hết thuế vào **hũ xổ số**.

Được ba thứ cùng lúc:

1. **Chống lạm phát thật** vì tiền rời khỏi ví người cày.
2. **Hũ xổ số tự lớn** thay vì phụ thuộc vào 80 xu mỗi vé. Giải luôn vấn đề đã nêu: sau khi có người trúng, hũ về 50.000 rồi chết dí vì 19 người không đủ mua vé để dồn hũ.
3. **Tiền quay lại tay người chơi**, chỉ là qua đường khác. Người cày trâu vô tình nuôi giải thưởng cho cả server, nghe rất đúng tinh thần sòng bạc.

Bản tin hằng ngày có thể khoe: *"Hũ xổ số hôm nay dày thêm 12.400 xu tiền thuế, cảm ơn các đồng chí cày thuê."*

### Ẩn tới mức nào

Đề nghị: **ẩn khỏi tài liệu, không ẩn khỏi phép tính.**

- `/help` không hề nhắc tới thuế, không patch note, không thông báo.
- Nhưng lúc trả kết quả `/lamviec` có dòng `💸 Thuế thu nhập: -688`, và `/lichsu` ghi một dòng `tax` riêng.

Lý do: nếu bot nói "nhận 2.750" mà số dư chỉ tăng 2.062 thì người chơi sẽ báo lỗi hoặc nghĩ bot ăn bớt. Vẫn là mánh bất ngờ, chỉ khác là con số cộng đúng.

Ở bậc từ 25% trở lên thì thêm một dòng nhỏ kiểu *"Thu nhập 24h của bạn đang ở bậc 25%. Nghỉ tay cho thuế hạ xuống."* để người ta hiểu mình đang bị gì và biết cách thoát.

### Ghi chú kỹ thuật

- Lương ghi vào lịch sử theo số **gộp** (loại `work`), thuế ghi thành dòng âm riêng (loại `tax`). Số dư vẫn đúng, lịch sử vẫn đọc được, và tính bậc thuế thì cộng các dòng `work` trong 24h.
- Truy vấn đã có sẵn chỉ mục `idx_tx_user (user_id, created_at)`, không tốn thêm gì.
- Khối lượng: khoảng 120 dòng kèm test cho bảng bậc thuế. Làm chung với mục 3 là gọn nhất.

---

## 5. Cho vay nặng lãi (ý của chủ bot)

**Vấn đề nó giải:** người thua sạch thì hết đường chơi, phải chờ điểm danh. Cho vay giữ họ ở lại bàn, và tạo drama khi tới hạn không trả nổi.

**Không thêm lệnh mới.** Nút `💰 Vay tiền` trong `/vi`.

### Hạn mức vay dựa trên uy tín, mà uy tín đến từ hai tính năng kia

```
Hạn mức = 5.000 (nền)
        + thưởng theo chức nghề (Chạy vặt 0 → Chủ tịch 100.000)
        + 30% giá trị tài sản đang sở hữu (nhà, xe, thú cưng)
        - dư nợ đang có
```

Đây là chỗ ba tính năng ăn khớp: chịu khó đi làm và mua nhà thì vay được nhiều, tay trắng thì chỉ vay nổi 5.000.

### Điều khoản

| | |
|---|---|
| Lãi | 20% cho kỳ hạn 24 giờ |
| Quá hạn | mỗi giờ cộng thêm 5% trên gốc, dồn tích |
| Cùng lúc | một khoản nợ, trả xong mới vay tiếp |

### Tới hạn không trả thì siết nợ

Bot tự kiểm tra mỗi 5 phút. Quá hạn 24 giờ thì siết theo thứ tự:

1. Trừ sạch ví.
2. Trừ tiếp két (đây là lý do két không còn là chỗ trốn nợ).
3. Vẫn thiếu thì **tịch thu tài sản**, thanh lý bằng 50% giá mua, ưu tiên món rẻ nhất trước.
4. Vẫn thiếu nữa thì xóa nợ và **đi tù 15 phút**, kèm thông báo công khai bêu tên.

### Tiền lãi đi đâu: cũng vào hũ xổ số

Giống thuế. Hũ xổ số thành nơi gom mọi khoản bot thu về, rồi trả lại cho người chơi qua giải thưởng.

### Đòi nợ: `/doino @nguoi`

Lệnh thứ sáu của nhóm tương tác, cùng khuôn với `/danh` và `/choc`. Chỉ đòi được người đang thực sự có nợ, đòi người sạch nợ thì bot cười vào mặt.

**Không đụng một xu nào.** Giá trị nằm ở chỗ bêu riếu:

- Lời lẽ leo thang theo số lần con nợ đã bị đòi: lần đầu nhắc nhẹ, tới lần thứ mười thì đọc loa cả xóm.
- GIF kèm theo lấy từ nekos.best.
- Con nợ dính trạng thái **😰 Bị dí nợ** trong 10 phút, hiện trong `/hoso` và `/vi`.
- Trạng thái đó cho `+10% lương làm việc` vì phải cày thêm ca trả nợ. Bị đòi nợ hóa ra lại có lợi, đúng kiểu đùa của bot.
- Có cooldown riêng cho từng cặp người đòi - con nợ để không ai spam.

**Khối lượng:** một bảng `loans`, một service, hai nút trong `/vi`, một lệnh `/doino`, một scheduler kiểm tra quá hạn. Khoảng 450 dòng kèm test.

---

## 6. Ba thứ phát hiện thêm khi đào số liệu, cần bạn quyết

### 6.1. Nhà cái đang lỗ, không phải lãi

RTP toàn bot **108,2%**: cược 5.347.495, trả về 5.786.423. Người chơi đang ăn nhà cái **438.928 xu**.

| Trò | Cược | Trả | RTP thực | RTP thiết kế |
|---|---|---|---|---|
| Blackjack | 4.087.430 | 4.123.532 | **100,9%** | 94,6% |
| Tài xỉu | 979.615 | 1.033.620 | **105,5%** | ~97% |
| Đua ngựa | 111.594 | 56.901 | 51,0% | ~85% |
| Bầu cua | 77.051 | 67.920 | 88,1% | ~92% |
| Cò quay | 37.600 | 31.600 | 84,0% | — |
| Xèng | 34.260 | 6.810 | 19,9% | 91,4% (đã sửa) |
| Tung xu | 7.425 | 10.720 | 144,4% | 100% |
| Xổ số | 3.500 | 0 | 0% | 80% |

Mẫu còn nhỏ nên phần lớn là may rủi, nhưng blackjack lệch 6 điểm qua 1.287 ván thì đáng theo dõi thêm.

### 6.2. Vận may 75% vẫn đang bật cho một người

Người `...752980` đang được đặt vận may **75%**, nghĩa là cứ 4 lần thua ở tài xỉu, bầu cua, tung xu, xèng, đua ngựa thì 3 lần được quay lại. Đây nhiều khả năng là lý do tài xỉu lên 105,5%.

Tôi đã nêu chuyện này trong báo cáo rà soát trước khi phát hành, bạn chưa quyết. Bot đã publish rồi nên giờ là câu hỏi thật: **giữ hay gỡ?**

### 6.3. Đua ngựa 51% đáng ngờ

Chia thưởng theo tỷ lệ cược thì RTP phải quanh 85%, không phải 51%. Có thể do 42 lượt là mẫu quá nhỏ, cũng có thể tiền bị nuốt khi trận không đủ người. Đáng kiểm tra khi rảnh.

---

## Thứ tự tôi đề nghị

1. **Nghề nghiệp có cấp bậc + thuế thu nhập** làm chung một đợt. Rẻ, chạm ngay vào lệnh dùng nhiều nhất, và thuế phải đi kèm chức cao chứ không thả lỏng rồi vá sau.
2. **Nhà, xe, thú cưng** sau, vì đây mới là thứ hút 1,7 triệu xu đang đóng băng.
3. Quyết vụ vận may 75% bất cứ lúc nào, chỉ tốn một câu trả lời.
