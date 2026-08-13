# 🎰 Casino Bot

Bot Discord sòng bạc giải trí: blackjack, tài xỉu, bầu cua, tung đồng xu, máy xèng, kèm hệ thống xu đầy đủ (điểm danh hằng ngày, chuyển xu, bảng xếp hạng). Xu chỉ để chơi vui, không có giá trị thật.

## Lệnh

| Lệnh | Mô tả |
|---|---|
| `/blackjack cuoc:<xu>` | Đấu bài với nhà cái. Nút Rút / Dừng / Gấp đôi. Blackjack trả 3:2 |
| `/taixiu cuoc:<xu> chon:<tài\|xỉu>` | Lắc 3 xúc xắc. Tài 11-17, Xỉu 4-10, ra bão (3 số giống nhau) là thua |
| `/baucua cuoc:<xu> chon:<linh vật>` | Bầu cua tôm cá, mỗi mặt trúng ăn 1:1 |
| `/coinflip cuoc:<xu> chon:<ngửa\|sấp>` | Tung đồng xu 50/50 |
| `/slots cuoc:<xu>` | Máy xèng, 7️⃣7️⃣7️⃣ ăn x100, 2 hình giống nhau hoàn tiền |
| `/keo nguoi cuoc` | Solo 1v1 tung đồng xu qua nút bấm, escrow tiền cược, ai thắng ăn cả |
| `/trieuphu` | Ai Là Triệu Phú: 15 câu, mốc an toàn câu 5/10, 50:50, dừng giữ thưởng, 1 lần/ngày |
| `/duangua cuoc ngua` | Đua ngựa animate: cả kênh cùng đặt trong 25s (nút + modal), odds theo phong độ, RTP 90% |
| `/xoso mua so` | Vé số 100 xu chọn 00-99 (tối đa 5 vé/kỳ), bot tự quay 21h VN, jackpot dồn, trúng chia hũ |
| `/bantin xem\|config` | Bản tin hằng ngày (mặc định 10h VN): top 10 server, thống kê 24h, jackpot. Tự chọn kênh nhộn nhịp nhất, config được giờ/kênh/tag |
| `/bank gui\|rut\|xem` | Két ngân hàng: tiền trong két miễn nhiễm trộm cắp |
| `/trom nguoi` + `/nopphat` | Trộm ví (40% ăn 15%, trượt tù 30 phút, nộp 2.000 xu ra sớm), khiên chặn được |
| `/shop` `/mua` `/tuido` | Shop: khiên chống trộm, nhẫn cầu hôn, hộp quà bí ẩn |
| `/cauhon` `/lyhon` | Cầu hôn (cần 💍), lễ cưới công khai, ly hôn mất phí |
| `/cash xem\|nap` | Tiền nạp 💵 (VND, one-way): reset CD Triệu phú 2.000đ/lần; nạp tay bởi owner, SePay sẽ tự động hóa |
| `/daily` | Điểm danh nhận 500 xu, chuỗi liên tục lên tối đa 1.000 xu/ngày (theo giờ VN) |
| `/lamviec` (`/work`) | Làm việc kiếm 100-300 xu mỗi giờ, cooldown lưu trong DB |
| `/sodu [nguoi]` | Xem ví, hạng, thống kê thắng thua |
| `/lichsu [soluong] [nguoi]` | Lịch sử giao dịch nhóm theo ngày, chấm màu 🟩🟥, mobile-friendly, ephemeral |
| `/chuyentien nguoi soxu` | Chuyển xu cho người khác |
| `/top` | Bảng xếp hạng 10 người giàu nhất |
| `/om` `/hon` `/danh` `/choc` `/xoadau` | Tương tác vui kèm GIF anime (nekos.best, fail-open) |
| `/bj` `/tx` `/bc` `/cf` | Viết tắt của blackjack, taixiu, baucua, coinflip |
| `/help` | Hướng dẫn trong Discord |
| `/casino-admin cong\|tru\|dat` | Quản lý xu (chỉ admin) |

Người chơi mới tự động được tặng 1.000 xu ở lần tương tác đầu tiên.

## Cài đặt

```bash
pnpm install
cp .env.example .env   # rồi điền token
pnpm deploy-commands   # đăng ký slash commands (chạy lại sau mỗi lần đổi lệnh)
pnpm dev               # chạy dev, hoặc: pnpm build && pnpm start
```

### Tạo bot trên Discord Developer Portal

1. Vào https://discord.com/developers/applications > **New Application**, đặt tên (ví dụ "Sòng Bạc").
2. Tab **General Information**: copy **Application ID**, dán vào `DISCORD_CLIENT_ID` trong `.env`.
3. Tab **Bot** > **Reset Token**: copy token, dán vào `DISCORD_TOKEN`. Token chỉ hiện 1 lần, giữ bí mật.
4. Không cần bật intent đặc quyền nào (bot chỉ dùng slash commands).
5. Lấy ID server: Discord > Settings > Advanced > bật **Developer Mode**, rồi chuột phải vào tên server > **Copy Server ID**, dán vào `DISCORD_GUILD_ID` (để lệnh hiện ngay lập tức).
6. Mời bot vào server, thay `YOUR_CLIENT_ID` bằng Application ID:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=277025508352
   ```

   (Quyền gồm: Send Messages, Embed Links, Read Message History, Use External Emojis.)

## Deploy (VPS + GHCR + GitHub Actions, giống code-dojo)

Push lên `main` là tự deploy:

```
GitHub push (main)
  → deploy.yml: test → build+push image → SSH redeploy
        ghcr.io/dadadadas111/casino-bot:latest (+ :<sha>)
  → VPS /opt/casino-bot: docker compose pull && up -d
```

- Deploy key SSH bị khóa forced-command vào `/opt/casino-bot/deploy.sh` (chỉ pull + up được).
- Secrets trên repo: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
- Trên VPS: `/opt/casino-bot/{docker-compose.yml,.env,deploy.sh}`, SQLite nằm ở `/opt/casino-bot/data/` (bind mount, sống qua các lần redeploy).

Thao tác tay trên VPS:

```bash
cd /opt/casino-bot
docker compose ps               # trạng thái
docker compose logs -f bot      # xem log
./deploy.sh                     # pull image mới + restart
IMAGE_TAG=<sha> docker compose up -d   # rollback về build cũ
```

## Kiến trúc

- discord.js v14 + TypeScript, một process duy nhất, intent chỉ cần `Guilds`.
- SQLite (better-sqlite3, WAL) tại `data/casino.db`: bảng `users` (số dư, chuỗi điểm danh, thống kê) và `transactions` (nhật ký mọi giao dịch).
- Luật chơi nằm trong `src/services/` (thuần logic, có test), lệnh Discord chỉ lo giao diện.
- Trừ xu ngay khi đặt cược bằng UPDATE có điều kiện (không thể âm tiền), trả thưởng khi kết thúc ván qua `settleGame`.
- Ván blackjack lưu trong RAM, tự động "Dừng" sau 2 phút không bấm nút.
- Rate limit per-user trong dispatcher (`src/index.ts`): game 5s, tương tác GIF 15s, mở kèo 30s, /top 10s. Cooldown dài (/daily theo ngày, /lamviec theo giờ) nằm trong DB nên restart không reset.

```bash
pnpm test        # 29 test: luật blackjack, economy, RTP máy xèng
pnpm typecheck
```
