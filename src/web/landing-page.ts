/**
 * Public pages served from the same listener as the webhook and dashboard.
 * Self-contained: no CDN, no build step, no external assets.
 */

const STYLE = `
  :root { color-scheme: dark; --gold:#f1c40f; --bg:#0f1115; --card:#171a21; --line:#262a33;
          --text:#e8eaed; --dim:#8b93a1; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif; }
  a { color: var(--gold); }
  .wrap { max-width: 860px; margin: 0 auto; padding: 0 20px; }
  header.hero { padding: 72px 0 56px; text-align: center;
    background: radial-gradient(ellipse at 50% -10%, #1d2430 0%, var(--bg) 65%); }
  .chip { display:inline-block; padding:5px 13px; border:1px solid var(--line);
          border-radius:999px; font-size:13px; color:var(--dim); margin-bottom:18px; }
  h1 { font-size: clamp(30px, 6vw, 46px); margin: 0 0 12px; letter-spacing:-.02em; }
  h1 .g { color: var(--gold); }
  .tag { color: var(--dim); font-size: 18px; margin: 0 auto 30px; max-width: 560px; }
  .cta { display:inline-flex; gap:10px; align-items:center; background:var(--gold); color:#111;
         font-weight:700; padding:14px 26px; border-radius:11px; text-decoration:none; font-size:16px; }
  .cta.ghost { background:transparent; color:var(--text); border:1px solid var(--line); font-weight:600; }
  .ctas { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  section { padding: 44px 0; border-top: 1px solid var(--line); }
  h2 { font-size: 22px; margin: 0 0 20px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }
  .card h3 { margin:0 0 6px; font-size:16px; }
  .card p { margin:0; color:var(--dim); font-size:14px; }
  code { background:#0b0d11; border:1px solid var(--line); border-radius:6px;
         padding:1px 6px; font-size:13.5px; }
  footer { padding: 34px 0 60px; color:var(--dim); font-size:14px; text-align:center;
           border-top:1px solid var(--line); }
  footer a { margin: 0 9px; }
  .legal h2 { margin-top: 34px; }
  .legal p, .legal li { color:#c7cdd8; }
  .legal ul { padding-left: 20px; }
  .note { background:#1b1a12; border:1px solid #3d3517; border-radius:12px;
          padding:14px 18px; color:#e8dfa8; font-size:14.5px; }
`;

const FOOTER = `<footer class="wrap">
  <a href="/">Trang chủ</a>·<a href="/terms">Điều khoản</a>·<a href="/privacy">Quyền riêng tư</a>
  <p>Sòng bạc ảo dùng xu không có giá trị quy đổi. Chơi cho vui thôi.</p>
</footer>`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="Bot Discord sòng bạc giải trí tiếng Việt: blackjack, tài xỉu, bầu cua, đua ngựa, Ai Là Triệu Phú và cả một khu phố để sống ảo.">
<style>${STYLE}</style></head><body>${body}${FOOTER}</body></html>`;
}

export function landingPage(clientId: string | undefined): string {
  const invite = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=277025508352`
    : '#';
  return page(
    'Casino Bot · Sòng bạc Discord tiếng Việt',
    `<header class="hero"><div class="wrap">
      <div class="chip">🎰 Bot Discord tiếng Việt</div>
      <h1>Cả một <span class="g">sòng bạc</span> trong server của bạn</h1>
      <p class="tag">Blackjack, tài xỉu, bầu cua, đua ngựa, cò quay Nga, Ai Là Triệu Phú với câu hỏi
        do AI ra mới mỗi ván. Kèm ngân hàng, trộm cắp, nhà tù, cưới hỏi và bản tin mỗi sáng.</p>
      <div class="ctas">
        <a class="cta" href="${invite}">Thêm vào server Discord</a>
        <a class="cta ghost" href="#tro-choi">Xem có gì chơi</a>
      </div>
    </div></header>

    <section class="wrap" id="tro-choi"><h2>🎮 Trò chơi</h2><div class="grid">
      <div class="card"><h3>🃏 Blackjack</h3><p>Đấu bài với nhà cái, có rút, dừng, gấp đôi. Blackjack trả 3:2.</p></div>
      <div class="card"><h3>🎲 Tài xỉu &amp; Bầu cua</h3><p>Hai món quốc dân, lắc xúc xắc ăn ngay, ra bão thì chịu.</p></div>
      <div class="card"><h3>🏇 Đua ngựa</h3><p>Cả kênh cùng đặt cửa theo tỷ lệ, ngựa chạy trực tiếp trên màn hình.</p></div>
      <div class="card"><h3>🔫 Cò quay Nga</h3><p>Từ hai người trở lên, ai dính đạn thì mất cược và nằm viện.</p></div>
      <div class="card"><h3>💰 Ai Là Triệu Phú</h3><p>15 câu hỏi tiếng Việt do AI soạn mới mỗi ván, thưởng tới 50.000 xu.</p></div>
      <div class="card"><h3>🎱 Xổ số</h3><p>Vé số 00-99, quay 21h mỗi tối, không ai trúng thì hũ dồn sang hôm sau.</p></div>
    </div></section>

    <section class="wrap"><h2>🏙️ Không chỉ có cờ bạc</h2><div class="grid">
      <div class="card"><h3>🏦 Ngân hàng</h3><p>Gửi xu vào két là trộm hết đường mò tới.</p></div>
      <div class="card"><h3>🦹 Trộm cắp &amp; nhà tù</h3><p>Móc túi bạn bè, xui thì bóc lịch và nộp phạt lũy tiến.</p></div>
      <div class="card"><h3>💒 Cưới hỏi</h3><p>Cầu hôn, mở tiệc cho cả kênh mừng tiền, hoặc cưới luôn hình nộm tự tạo.</p></div>
      <div class="card"><h3>🛒 Cửa hàng</h3><p>Khiên chống trộm, mũ bảo hiểm, bùa may mắn, cà phê xóa cooldown.</p></div>
      <div class="card"><h3>📰 Bản tin mỗi sáng</h3><p>Bảng xếp hạng, ai thắng đậm thua đau, kèm lời bình do AI viết.</p></div>
      <div class="card"><h3>⚡ Gõ nhanh</h3><p>Ngại slash command thì dùng <code>!tx 1k tai</code>, prefix đổi được.</p></div>
    </div></section>

    <section class="wrap"><h2>🚀 Bắt đầu trong 30 giây</h2>
      <div class="grid">
        <div class="card"><h3>1. Mời bot</h3><p>Bấm nút phía trên, chọn server bạn có quyền quản lý.</p></div>
        <div class="card"><h3>2. Gõ <code>/help</code></h3><p>Hướng dẫn chia trang, bấm nút để xem từng mảng.</p></div>
        <div class="card"><h3>3. Gõ <code>/daily</code></h3><p>Nhận xu miễn phí rồi vào bàn. Tân thủ được tặng 1.000 xu.</p></div>
      </div>
      <p class="note" style="margin-top:18px">💡 Xu trong bot là tiền ảo, không mua bán hay quy đổi
        thành tiền thật được. Đây là trò chơi giải trí, không phải dịch vụ cờ bạc ăn tiền.</p>
    </section>`,
  );
}

export const TERMS_PAGE = page(
  'Điều khoản sử dụng · Casino Bot',
  `<div class="wrap legal">
    <h1 style="margin-top:44px">Điều khoản sử dụng</h1>
    <p style="color:var(--dim)">Cập nhật: 18/08/2026</p>

    <p>Khi mời Casino Bot vào server hoặc dùng bất kỳ lệnh nào của bot, bạn đồng ý với các điều khoản dưới đây.</p>

    <h2>1. Bản chất dịch vụ</h2>
    <p>Casino Bot là trò chơi giải trí trong Discord. Toàn bộ "xu" trong bot là <strong>tiền ảo,
      không có giá trị thật</strong>, không phải tài sản, không mua bán, chuyển nhượng hay quy đổi
      thành tiền mặt hoặc hiện vật dưới bất kỳ hình thức nào. Bot không phải sòng bạc, không nhận
      cá cược bằng tiền thật và không trả thưởng bằng tiền thật.</p>

    <h2>2. Độ tuổi</h2>
    <p>Bạn phải đủ tuổi tối thiểu sử dụng Discord theo quy định tại nơi bạn sinh sống (thường là 13 tuổi).</p>

    <h2>3. Tiền nạp</h2>
    <ul>
      <li>Tiền nạp (VND) chỉ dùng để mua tiện ích trong bot, ví dụ chơi lại Ai Là Triệu Phú sớm hoặc đổi lấy xu.</li>
      <li>Dòng tiền <strong>một chiều</strong>: tiền nạp và xu không bao giờ được quy đổi ngược lại thành tiền thật.</li>
      <li>Giao dịch đã hoàn tất <strong>không hoàn lại</strong>, trừ trường hợp lỗi kỹ thuật khiến tiền
        không vào tài khoản. Khi đó hãy liên hệ chủ bot kèm mã giao dịch để được xử lý.</li>
      <li>Bạn có trách nhiệm chuyển đúng nội dung chuyển khoản mà bot cung cấp. Chuyển sai nội dung
        có thể khiến tiền không tự vào tài khoản và cần đối soát thủ công.</li>
    </ul>

    <h2>4. Hành vi bị cấm</h2>
    <ul>
      <li>Lợi dụng lỗi phần mềm để tạo xu hoặc trục lợi thay vì báo cho chủ bot.</li>
      <li>Dùng công cụ tự động, script, hoặc nhiều tài khoản để trục lợi phần thưởng.</li>
      <li>Mua bán, trao đổi tài khoản, xu hoặc vật phẩm lấy tiền thật.</li>
      <li>Dùng bot để quấy rối người khác hoặc vi phạm Điều khoản dịch vụ của Discord.</li>
    </ul>

    <h2>5. Xử lý vi phạm</h2>
    <p>Chủ bot có quyền điều chỉnh số dư, thu hồi phần thưởng có được do lỗi hoặc gian lận, và
      từ chối phục vụ tài khoản vi phạm mà không cần báo trước.</p>

    <h2>6. Tính sẵn sàng và thay đổi</h2>
    <p>Dịch vụ được cung cấp "nguyên trạng", không cam kết hoạt động liên tục. Tính năng, tỷ lệ
      thưởng và giá vật phẩm có thể thay đổi để cân bằng trò chơi. Thay đổi lớn sẽ được thông báo
      trong server qua ghi chú cập nhật của bot.</p>

    <h2>7. Giới hạn trách nhiệm</h2>
    <p>Chủ bot không chịu trách nhiệm cho việc mất xu, mất vật phẩm hay gián đoạn dịch vụ do lỗi
      kỹ thuật, sự cố hạ tầng hoặc thay đổi từ phía Discord.</p>

    <h2>8. Liên hệ</h2>
    <p>Mọi thắc mắc, khiếu nại về giao dịch hoặc yêu cầu xóa dữ liệu: liên hệ trực tiếp chủ bot
      qua Discord.</p>
  </div>`,
);

export const PRIVACY_PAGE = page(
  'Chính sách quyền riêng tư · Casino Bot',
  `<div class="wrap legal">
    <h1 style="margin-top:44px">Chính sách quyền riêng tư</h1>
    <p style="color:var(--dim)">Cập nhật: 18/08/2026</p>

    <h2>1. Dữ liệu bot lưu lại</h2>
    <ul>
      <li><strong>ID người dùng Discord</strong>: để gắn ví xu và tiến trình chơi với đúng người.</li>
      <li><strong>ID server và ID kênh</strong>: để hiển thị bảng xếp hạng theo server và chọn kênh đăng bản tin.</li>
      <li><strong>Dữ liệu trò chơi</strong>: số dư, lịch sử giao dịch, vật phẩm, thống kê thắng thua,
        tình trạng hôn nhân trong game, tiền án tiền sự trong game.</li>
      <li><strong>Giao dịch nạp tiền</strong>: số tiền, thời điểm, mã giao dịch và nội dung chuyển khoản
        do cổng thanh toán gửi sang, phục vụ đối soát.</li>
    </ul>

    <h2>2. Dữ liệu bot KHÔNG lưu</h2>
    <p>Bot <strong>không lưu nội dung tin nhắn</strong> của bạn. Để hỗ trợ lệnh gõ nhanh dạng
      <code>!tx 100 tai</code>, bot có đọc tin nhắn trong kênh, nhưng chỉ xử lý ngay tại chỗ rồi bỏ đi;
      thứ duy nhất được ghi lại là <em>số lượt lệnh của bot theo từng kênh</em> để biết kênh nào
      nên đăng bản tin. Bot không lưu số điện thoại, email, số tài khoản ngân hàng của người chơi.</p>

    <h2>3. Mục đích sử dụng</h2>
    <p>Dữ liệu chỉ dùng để vận hành trò chơi, chống gian lận, đối soát giao dịch nạp tiền và cân bằng
      tính năng. Chúng tôi <strong>không bán, không chia sẻ</strong> dữ liệu cho bên thứ ba vì mục đích quảng cáo.</p>

    <h2>4. Bên thứ ba</h2>
    <ul>
      <li><strong>Discord</strong>: nền tảng vận hành bot.</li>
      <li><strong>DeepSeek</strong>: sinh câu hỏi cho trò Ai Là Triệu Phú và lời bình cho bản tin.
        Chỉ gửi đi nội dung câu hỏi và số liệu trò chơi đã tổng hợp, không gửi ID hay danh tính người chơi.</li>
      <li><strong>SePay</strong>: nhận thông báo chuyển khoản ngân hàng để cộng tiền nạp tự động.</li>
      <li><strong>nekos.best</strong>: lấy ảnh động cho các lệnh tương tác vui.</li>
    </ul>

    <h2>5. Lưu trữ và bảo mật</h2>
    <p>Dữ liệu nằm trong cơ sở dữ liệu SQLite trên máy chủ riêng do chủ bot quản lý, được sao lưu
      hằng ngày và giữ 14 ngày gần nhất. Trang quản trị yêu cầu đăng nhập và chỉ chủ bot truy cập được.</p>

    <h2>6. Thời gian lưu</h2>
    <p>Dữ liệu trò chơi được giữ chừng nào bạn còn dùng bot. Riêng bản ghi giao dịch nạp tiền được
      giữ lâu hơn để phục vụ đối soát và giải quyết khiếu nại.</p>

    <h2>7. Quyền của bạn</h2>
    <p>Bạn có thể yêu cầu xem hoặc xóa dữ liệu trò chơi của mình bất cứ lúc nào bằng cách liên hệ
      chủ bot qua Discord. Sau khi xóa, số dư và tiến trình sẽ mất vĩnh viễn và không khôi phục được.</p>

    <h2>8. Thay đổi chính sách</h2>
    <p>Nếu chính sách thay đổi đáng kể, bot sẽ thông báo trong server qua ghi chú cập nhật.</p>
  </div>`,
);
