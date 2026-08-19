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

**Cần bạn quyết một chỗ:** Chủ tịch (3.500 xu) đi kèm Siêu xe (4 phút) thì thành 52.000 xu/giờ nếu ngồi cày liên tục. Ba cách xử lý, chọn một:

1. Kệ, phải cày 500 ca (~83 giờ) mới tới đó, tự nó đã hạn chế.
2. Xe không cộng dồn với chức cao: cooldown lấy mức tốt hơn chứ không nhân đôi.
3. Hạ lương chức đỉnh xuống 1.500-2.500.

Tôi nghiêng về **cách 2**.

**Khối lượng:** một cột `work_count`, sửa nhẹ service, đổi lời nhắn. Khoảng 150 dòng kèm test. Rẻ hơn hẳn mục 2, làm trước cũng được.

---

## 4. Ba thứ phát hiện thêm khi đào số liệu, cần bạn quyết

### 4.1. Nhà cái đang lỗ, không phải lãi

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

### 4.2. Vận may 75% vẫn đang bật cho một người

Người `...752980` đang được đặt vận may **75%**, nghĩa là cứ 4 lần thua ở tài xỉu, bầu cua, tung xu, xèng, đua ngựa thì 3 lần được quay lại. Đây nhiều khả năng là lý do tài xỉu lên 105,5%.

Tôi đã nêu chuyện này trong báo cáo rà soát trước khi phát hành, bạn chưa quyết. Bot đã publish rồi nên giờ là câu hỏi thật: **giữ hay gỡ?**

### 4.3. Đua ngựa 51% đáng ngờ

Chia thưởng theo tỷ lệ cược thì RTP phải quanh 85%, không phải 51%. Có thể do 42 lượt là mẫu quá nhỏ, cũng có thể tiền bị nuốt khi trận không đủ người. Đáng kiểm tra khi rảnh.

---

## Thứ tự tôi đề nghị

1. **Nghề nghiệp có cấp bậc** trước, vì rẻ và chạm ngay vào lệnh dùng nhiều nhất.
2. **Nhà, xe, thú cưng** sau, vì đây mới là thứ hút 1,7 triệu xu đang đóng băng.
3. Quyết vụ vận may 75% bất cứ lúc nào, chỉ tốn một câu trả lời.
