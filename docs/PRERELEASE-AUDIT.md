# Rà soát trước phát hành — casino-bot

Ngày: 18/08/2026 · Phiên bản: 2.9.0 · Phạm vi: toàn bộ `src/` (81 file, ~9.800 dòng), hạ tầng VPS, dashboard, webhook thanh toán.

Hiện trạng khi rà soát: 51 lệnh, 7 server, 19 người chơi, 2.789 giao dịch, 10.000đ tiền nạp thật đã xử lý.

---

## 1. Lỗi đã tìm ra và đã sửa

### 🔴 Chặn phát hành

**1.1 Khiên chống trộm tống nhầm người vào tù** (`trom.command.ts`)
Khi nạn nhân có khiên, code gọi `tryRob(..., roll = 1)` để "đốt lượt". Nhưng `roll = 1` rơi đúng vào nhánh thất bại, nên kẻ trộm **bị giam 5 phút, bị tăng phí chuộc lũy tiến và bị ghi tiền án** — trong khi tin nhắn chỉ nói "khiên đã chặn". Người chơi bị khóa mọi lệnh mà không hiểu vì sao.
→ Thêm `economy.startRobCooldown()` chỉ tiêu lượt, không xét xử.

**1.2 Mất trắng tiền cược mỗi lần deploy** (toàn bộ game có phiên)
Tiền bị trừ ngay khi đặt cược, ván nằm trong RAM. Mọi lần cập nhật bot (đã 30+ lần), crash, hay restart VPS đều xóa sạch phiên: người chơi mất tiền, không ván, không hoàn.
→ Mỗi game xuất `refundPending*()`; `SIGTERM`/`SIGINT`/`uncaughtException` hoàn toàn bộ cược đang treo trước khi thoát. Đã kiểm chứng trên production: `[bot] SIGTERM: refunded 0 open stake(s)`.

**1.3 Admin server lạ in được xu vào nền kinh tế chung** (`admin.command.ts`)
Xu dùng chung toàn hệ thống, nhưng `/casino-admin` chỉ cần quyền Administrator **của server bất kỳ**. Sau khi phát hành, ai cũng có thể mời bot vào server của mình, tự làm admin và bơm xu (10.000/lần, 65% trót lọt) rồi chuyển đi.
→ Chỉ `BOT_OWNER_ID` chỉnh được số dư.

**1.4 Không có backup dữ liệu** (hạ tầng)
Toàn bộ ví, lịch sử và **sổ cái tiền nạp thật** nằm trong một file SQLite 496K duy nhất, không bản sao. Mất đĩa hoặc lỡ tay xóa là mất sạch, không đối soát được với ngân hàng.
→ `backup.sh` dùng `VACUUM INTO` (an toàn với WAL đang ghi), cron 3h17 hằng đêm, giữ 14 ngày, đã chạy thật.

### 🟠 Nguy cơ cao

**1.5 `/top` trộn người từ server khác**
Kinh tế là chung nên bảng xếp hạng liệt kê cả người lạ ở server viewer chưa từng vào. Sau phát hành thì bảng vô nghĩa.
→ Lọc theo `user_guilds` của server hiện tại.

**1.6 Spam ping cả server**
`/honle` ping `@here` mỗi lần mở tiệc (5.000 xu, không cooldown) và bản tin hằng ngày mặc định ping `@everyone` cho mọi server mới. Đây là cách nhanh nhất để bot bị kick hoặc bị report.
→ Bỏ ping ở tiệc cưới; bản tin mặc định **tắt** ping, muốn thì admin tự bật.

**1.7 Kết quả xổ số không kiểm tra quyền kênh**
Cùng lớp lỗi đã sửa cho patch note hôm trước: gửi vào kênh không có quyền thì thất bại âm thầm.
→ Dùng chung `findAnnounceChannel()` có kiểm tra quyền.

**1.8 Bộ đếm chống dò mật khẩu phình vô hạn**
`LoginThrottle` giữ mọi IP từng thất bại, không bao giờ dọn. Kẻ tấn công đổi IP liên tục làm bot ăn hết RAM.
→ Dọn mục hết hạn khi vượt 1.000 mục.

**1.9 Log Docker không giới hạn + không healthcheck**
Log json chạy mãi sẽ lấp đầy đĩa VPS (đang dùng 87%).
→ Giới hạn 10MB × 5 file, thêm healthcheck gọi `/health`.

---

## 2. Đã kiểm chứng là AN TOÀN (không phải sửa)

| Hạng mục | Kết luận |
|---|---|
| Bí mật trong git | `.env` không bị track, không có token/API key hardcode trong `src/` |
| Số học tiền bạc | Mọi thay đổi số dư đều ghi log delta; test dựng lại được số dư từ đầu qua toàn bộ lịch sử |
| Âm tiền | Trừ tiền bằng `UPDATE ... WHERE balance >= ?`, chuyển khoản trong transaction |
| Đua ngựa / cò quay / kèo | Không có double-settle: mọi lần xóa phiên đều đồng bộ trước `await` đầu tiên |
| RTP blackjack | Mô phỏng 300.000 ván: **94,6%**, đúng thiết kế. Con số 107% trên dashboard chỉ là mẫu nhỏ |
| Dashboard | Mật khẩu chỉ lưu hash scrypt, cookie HttpOnly+Secure+SameSite=Strict, API trả 401 khi chưa đăng nhập, khóa IP sau 5 lần sai |
| Webhook SePay | Xác thực API key, chống trùng theo transaction id, cộng theo số tiền thực nhận, giao dịch lạ vào hàng chờ thay vì mất |
| Cổng mạng | Bot chỉ mở 127.0.0.1:3020, ra ngoài qua nginx + TLS |
| Tên hình nộm | Lọc `@`, markdown, xuống dòng trước khi hiện công khai (chống giả mạo `@everyone`) |
| Fail-open dịch vụ ngoài | DeepSeek và nekos.best hỏng thì game vẫn chạy, chỉ mất phần phụ |

---

## 3. Việc còn lại — cần bạn quyết

**3.1 🔴 Vận may ẩn đang bật cho một tài khoản**
`yv` đang có `luck = 0.75`: thua ván nào cũng được chơi lại lặng lẽ với xác suất 75% ở tài xỉu, bầu cua, tung xu, xèng, đua ngựa. Chuyện riêng trong nhóm bạn thì vui, nhưng khi mở cho người lạ mà bot vẫn quảng cáo tỉ lệ công bằng thì đây là rủi ro uy tín lớn nhất: chỉ cần một người soi `/lichsu` hoặc thống kê thắng thua là lộ.
Gỡ bằng: `/luck dat nguoi:@yv muc:0` (một lệnh, hiệu lực ngay).

**3.2 Điều khoản và quyền riêng tư**
Bot nhận tiền thật nên nếu muốn Discord duyệt (verify) thì bắt buộc có link Terms of Service và Privacy Policy. Cũng nên ghi rõ trong `/help`: xu không quy đổi ngược ra tiền, tiền nạp không hoàn.

**3.3 Ngưỡng 100 server**
Bot đang dùng intent đặc quyền Message Content (cho lệnh `!`). Quá 100 server thì Discord bắt buộc verify, và intent này thường bị từ chối nếu không chứng minh được lý do. Phương án dự phòng: tắt `ENABLE_PREFIX_COMMANDS`, bot vẫn chạy đủ bằng slash command.

**3.4 Đĩa VPS còn 2,6GB (87%)**
Chưa nguy cấp nhưng nên theo dõi; phần lớn do các project khác trên cùng máy, không phải casino-bot.

**3.5 Sao lưu ngoài máy chủ**
Backup hiện nằm cùng ổ đĩa với dữ liệu gốc. Mất VPS là mất cả hai. Nên đẩy định kỳ sang nơi khác (rclone lên cloud, hoặc kéo về máy bạn).

---

## 4. Kết luận

Sau các bản vá trên, bot **đủ điều kiện phát hành** trong phạm vi vài chục tới vài trăm server: không còn lỗi mất tiền, không còn lỗ hổng in xu, có backup, có hoàn tiền khi restart, và có test tự động (196 test) chặn hồi quy.

Việc duy nhất tôi khuyên làm trước khi mở rộng công khai là **gỡ vận may ẩn** (mục 3.1) và **bổ sung ToS/Privacy** (3.2).
