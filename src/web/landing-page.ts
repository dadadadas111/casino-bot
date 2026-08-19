/**
 * Public pages served from the same listener as the webhook and dashboard.
 * No build step and no asset pipeline: the mark is inlined (see logo.ts) and
 * the only outside request is the webfont stylesheet.
 */

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bungee&family=Be+Vietnam+Pro:wght@300;400;600;800&family=JetBrains+Mono:wght@500;700&display=swap';

/**
 * The palette is lifted straight off the bot's own chip: table felt, chip
 * red, the cream inlay, the gold ring and the spade's black.
 */
const STYLE = `
  :root {
    --felt: #0b3b2a;
    --felt-deep: #06231a;
    --felt-line: #12503a;
    --chip: #c4342b;
    --chip-dark: #8f2019;
    --cream: #f3eddf;
    --cream-dim: #cfc7b4;
    --gold: #d8ab33;
    --ink: #10120f;
    --shadow: 0 18px 40px rgba(0,0,0,.45);
    color-scheme: dark;
  }

  * { box-sizing: border-box; }

  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

  body {
    margin: 0;
    color: var(--cream);
    background-color: var(--felt-deep);
    /* Felt: a soft pool of light on the table, plus woven noise. */
    background-image:
      radial-gradient(120% 80% at 50% -10%, #14624a 0%, rgba(11,59,42,0) 62%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
    font-family: "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--gold); }
  :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }

  .wrap { width: 100%; max-width: 68rem; margin: 0 auto; padding: 0 clamp(1.1rem, 4vw, 2rem); }

  /* ---------- wordmark ---------- */

  .mark { display: inline-flex; align-items: center; gap: .7rem; text-decoration: none; color: inherit; }
  .mark img { width: 44px; height: 44px; display: block; clip-path: circle(41.5% at 50% 50%); }
  .mark span {
    font-family: Bungee, "Be Vietnam Pro", sans-serif;
    font-size: 1.05rem;
    letter-spacing: .06em;
    color: var(--cream);
    line-height: 1;
    padding-top: .18em;
  }

  .topbar { padding: 1.4rem 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .topbar nav { display: flex; gap: 1.4rem; font-size: .92rem; }
  .topbar nav a { color: var(--cream-dim); text-decoration: none; }
  .topbar nav a:hover { color: var(--gold); }
  @media (max-width: 34rem) { .topbar nav { display: none; } }

  /* ---------- hero ---------- */

  .hero { padding: clamp(2.5rem, 7vw, 5rem) 0 clamp(3rem, 7vw, 5rem); text-align: center; }

  .hero-chip {
    width: clamp(124px, 26vw, 176px);
    height: auto;
    clip-path: circle(41.5% at 50% 50%);
    filter: drop-shadow(0 16px 26px rgba(0,0,0,.5));
    animation: settle .9s cubic-bezier(.2,.9,.25,1) both;
  }
  @keyframes settle {
    from { transform: translateY(-38px) rotate(-26deg) scale(.86); opacity: 0; }
    to   { transform: none; opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) { .hero-chip { animation: none; } }

  .eyebrow {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 1.5rem 0 .9rem;
  }

  h1 {
    font-size: clamp(2rem, 5.6vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -.03em;
    line-height: 1.06;
    text-wrap: balance;
    margin: 0 auto .9rem;
    max-width: 22ch;
  }
  h1 em { font-style: normal; color: var(--gold); }

  .lede {
    font-weight: 300;
    font-size: clamp(1rem, 2.1vw, 1.15rem);
    color: var(--cream-dim);
    margin: 0 auto;
    max-width: 34rem;
  }

  .ctas { display: flex; gap: .8rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem; }

  .btn {
    display: inline-flex; align-items: center; gap: .5rem;
    padding: .85rem 1.7rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    border: 1px solid transparent;
    transition: transform .16s ease, box-shadow .16s ease;
  }
  .btn-gold { background: var(--gold); color: var(--ink); box-shadow: 0 10px 22px rgba(216,171,51,.24); }
  .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(216,171,51,.32); }
  .btn-ghost { border-color: var(--felt-line); color: var(--cream); }
  .btn-ghost:hover { border-color: var(--gold); color: var(--gold); }
  @media (prefers-reduced-motion: reduce) { .btn:hover { transform: none; } }

  /* ---------- live jackpot ---------- */

  .pot {
    margin: 2.6rem auto 0;
    max-width: 30rem;
    border: 1px solid var(--gold);
    border-radius: 1rem;
    padding: 1.1rem 1.4rem;
    background: linear-gradient(180deg, rgba(216,171,51,.12), rgba(216,171,51,.03));
    display: flex; flex-direction: column; gap: .15rem; align-items: center;
  }
  .pot-label {
    font-family: "JetBrains Mono", monospace;
    font-size: .68rem; font-weight: 700; letter-spacing: .18em;
    text-transform: uppercase; color: var(--gold);
  }
  .pot-value {
    font-family: "JetBrains Mono", monospace;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-size: clamp(1.9rem, 6vw, 2.7rem);
    letter-spacing: -.02em;
    color: var(--cream);
    line-height: 1.1;
  }
  .pot-note { font-size: .82rem; color: var(--cream-dim); font-weight: 300; }

  /* ---------- chip rail ---------- */

  .rail { display: flex; gap: .7rem; justify-content: center; padding: 2.6rem 0; }
  .rail i {
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--chip);
    box-shadow: inset 0 0 0 2px var(--chip-dark), inset 0 0 0 5px var(--cream);
    opacity: .5;
  }
  .rail i:nth-child(even) {
    background: var(--cream);
    box-shadow: inset 0 0 0 2px var(--cream-dim), inset 0 0 0 5px var(--gold);
  }

  /* ---------- sections ---------- */

  .band { padding: clamp(2.5rem, 6vw, 4rem) 0; }
  .band-head { margin-bottom: 2rem; }
  .band-head h2 {
    font-size: clamp(1.45rem, 3.4vw, 2rem);
    font-weight: 800;
    letter-spacing: -.02em;
    margin: 0 0 .4rem;
    text-wrap: balance;
  }
  .band-head p { margin: 0; color: var(--cream-dim); font-weight: 300; max-width: 40rem; }

  /* ---------- game cards ---------- */

  .hand { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }

  .card {
    position: relative;
    background: var(--cream);
    color: var(--ink);
    border-radius: .85rem;
    padding: 1.15rem 1.2rem 1.2rem;
    box-shadow: var(--shadow);
    transition: transform .2s cubic-bezier(.2,.9,.25,1), box-shadow .2s ease;
    overflow: hidden;
  }
  .card::after {
    content: "";
    position: absolute; inset: .34rem;
    border: 1px solid rgba(16,18,15,.14);
    border-radius: .55rem;
    pointer-events: none;
  }
  .card:hover { transform: translateY(-6px) rotate(-1deg); box-shadow: 0 26px 46px rgba(0,0,0,.5); }
  @media (prefers-reduced-motion: reduce) { .card:hover { transform: none; } }

  /* The corner index carries the game's defining number, not decoration. */
  .card-index {
    font-family: "JetBrains Mono", monospace;
    font-weight: 700;
    font-size: .82rem;
    letter-spacing: -.02em;
    color: var(--chip);
    display: flex; align-items: baseline; justify-content: space-between; gap: .6rem;
    margin-bottom: .7rem;
  }
  .card-index em { font-style: normal; font-size: 1.15rem; }
  .card h3 { margin: 0 0 .3rem; font-size: 1.06rem; font-weight: 800; letter-spacing: -.01em; }
  .card p { margin: 0; font-size: .88rem; line-height: 1.6; color: #4a4c46; font-weight: 400; }
  .card-cmd {
    display: inline-block; margin-top: .8rem;
    font-family: "JetBrains Mono", monospace;
    font-size: .76rem; font-weight: 500;
    background: rgba(16,18,15,.07); color: #3a3c37;
    padding: .16rem .45rem; border-radius: .3rem;
  }

  /* ---------- life list ---------- */

  .life { display: grid; gap: 0; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); }
  .life div {
    padding: 1.1rem 0;
    border-top: 1px solid var(--felt-line);
    display: grid; grid-template-columns: 2.2rem 1fr; gap: .2rem 0;
    align-items: start;
  }
  .life span { font-size: 1.3rem; line-height: 1.5; grid-row: span 2; }
  .life h3 { margin: 0; font-size: 1rem; font-weight: 600; }
  .life p { margin: 0; font-size: .88rem; color: var(--cream-dim); font-weight: 300; }
  @media (min-width: 40rem) { .life div { padding-right: 2rem; } }

  /* ---------- steps ---------- */

  .steps { display: grid; gap: 1.2rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); counter-reset: step; }
  .steps div { counter-increment: step; }
  .steps div::before {
    content: counter(step);
    display: inline-flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: 50%;
    background: var(--chip); color: var(--cream);
    font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: .9rem;
    box-shadow: inset 0 0 0 2px rgba(243,237,223,.5);
    margin-bottom: .7rem;
  }
  .steps h3 { margin: 0 0 .2rem; font-size: 1rem; font-weight: 600; }
  .steps p { margin: 0; font-size: .88rem; color: var(--cream-dim); font-weight: 300; }

  /* ---------- stats ---------- */

  .stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    border: 1px solid var(--felt-line); border-radius: 1rem; overflow: hidden;
  }
  .stats div { padding: 1.15rem 1.3rem; border-right: 1px solid var(--felt-line); }
  .stats div:last-child { border-right: 0; }
  .stats b {
    display: block;
    font-family: "JetBrains Mono", monospace;
    font-variant-numeric: tabular-nums;
    font-size: 1.7rem; font-weight: 700; letter-spacing: -.03em; color: var(--gold);
    line-height: 1.2;
  }
  .stats small { font-size: .78rem; color: var(--cream-dim); letter-spacing: .04em; }

  /* ---------- closing ---------- */

  .closer { text-align: center; padding: clamp(3rem, 8vw, 5rem) 0; }
  .closer h2 { font-size: clamp(1.6rem, 4.4vw, 2.4rem); font-weight: 800; letter-spacing: -.025em; margin: 0 0 .7rem; }
  .closer p { color: var(--cream-dim); font-weight: 300; margin: 0 auto 1.8rem; max-width: 32rem; }

  .fineprint {
    border: 1px solid var(--felt-line);
    border-left: 3px solid var(--gold);
    border-radius: .6rem;
    padding: 1rem 1.2rem;
    background: rgba(0,0,0,.16);
    color: var(--cream-dim);
    font-size: .88rem;
    font-weight: 300;
    max-width: 44rem;
    margin: 2.4rem auto 0;
    text-align: left;
  }

  /* ---------- footer ---------- */

  footer { border-top: 1px solid var(--felt-line); padding: 2.2rem 0 3.4rem; }
  .foot-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
  .foot-links { display: flex; gap: 1.3rem; font-size: .9rem; }
  .foot-links a { color: var(--cream-dim); text-decoration: none; }
  .foot-links a:hover { color: var(--gold); }
  .foot-note { margin: 1.4rem 0 0; font-size: .82rem; color: #7d8c84; font-weight: 300; }

  /* ---------- legal pages ---------- */

  .paper {
    background: var(--cream);
    color: var(--ink);
    border-radius: 1rem;
    box-shadow: var(--shadow);
    padding: clamp(1.6rem, 5vw, 3.2rem);
    margin: 1rem auto 3.5rem;
    max-width: 48rem;
  }
  .paper h1 { font-size: clamp(1.7rem, 4.5vw, 2.4rem); margin: 0 0 .3rem; max-width: none; text-align: left; }
  .paper .updated { font-family: "JetBrains Mono", monospace; font-size: .78rem; color: #6d6f68; margin: 0 0 2rem; }
  .paper h2 {
    font-size: 1.08rem; font-weight: 800; letter-spacing: -.01em;
    margin: 2rem 0 .5rem; padding-top: 1.2rem;
    border-top: 1px solid rgba(16,18,15,.12);
  }
  .paper h2:first-of-type { border-top: 0; padding-top: 0; }
  .paper p, .paper li { color: #3a3c37; font-size: .95rem; }
  .paper ul { padding-left: 1.15rem; }
  .paper li { margin-bottom: .4rem; }
  .paper strong { color: var(--ink); font-weight: 600; }
  .paper code {
    font-family: "JetBrains Mono", monospace; font-size: .85rem;
    background: rgba(16,18,15,.07); padding: .1rem .35rem; border-radius: .25rem;
  }
`;

interface Game {
  /** The number that defines this game, printed as the card's corner index. */
  index: string;
  suit: string;
  name: string;
  blurb: string;
  cmd: string;
}

const GAMES: Game[] = [
  {
    index: '3:2',
    suit: '🃏',
    name: 'Blackjack',
    blurb: 'Đấu bài với nhà cái. Rút, dừng, gấp đôi, và blackjack trả 3 ăn 2.',
    cmd: '/blackjack',
  },
  {
    index: '11-17',
    suit: '🎲',
    name: 'Tài xỉu',
    blurb: 'Lắc ba xúc xắc, chọn cửa Tài hay Xỉu. Ra bão thì nhà cái ôm hết.',
    cmd: '/taixiu',
  },
  {
    index: '6',
    suit: '🦀',
    name: 'Bầu cua tôm cá',
    blurb: 'Sáu linh vật, mỗi mặt trúng ăn một lần tiền. Món quốc dân ngày Tết.',
    cmd: '/baucua',
  },
  {
    index: 'x100',
    suit: '🎰',
    name: 'Máy xèng',
    blurb: 'Hai hình cao đã ăn tiền, ba con bảy đỏ thì trúng gấp trăm lần cược.',
    cmd: '/slots',
  },
  {
    index: '4',
    suit: '🏇',
    name: 'Đua ngựa',
    blurb: 'Xem phong độ bốn con rồi cả kênh đặt cửa. Ngựa chạy trực tiếp trên màn hình.',
    cmd: '/duangua',
  },
  {
    index: '1/6',
    suit: '🔫',
    name: 'Cò quay Nga',
    blurb: 'Từ hai người trở lên. Ai dính đạn thì nằm viện, người sống chia sạch tiền.',
    cmd: '/coquay',
  },
  {
    index: '15',
    suit: '💡',
    name: 'Ai Là Triệu Phú',
    blurb: 'Mười lăm câu hỏi tiếng Việt, ba mươi giây mỗi câu, leo thang tới 50.000 xu.',
    cmd: '/trieuphu',
  },
  {
    index: '00-99',
    suit: '🎱',
    name: 'Xổ số',
    blurb: 'Chọn một con số, quay lúc 9 giờ tối. Không ai trúng thì hũ dồn sang mai.',
    cmd: '/xoso',
  },
  {
    index: 'x11',
    suit: '🎴',
    name: 'Cao hay Thấp',
    blurb: 'Đoán lá kế tiếp cao hơn hay thấp hơn. Càng đoán đúng tiền càng nhân, rút lúc nào cũng được.',
    cmd: '/hilo',
  },
  {
    index: '3/16',
    suit: '💣',
    name: 'Dò mìn',
    blurb: 'Ba quả mìn giấu trong mười sáu ô. Mở được ô nào ăn ô đó, tham quá thì mất sạch.',
    cmd: '/domin',
  },
];

interface LifeBit {
  icon: string;
  name: string;
  blurb: string;
}

const LIFE: LifeBit[] = [
  {
    icon: '💼',
    name: 'Đi làm lên chức',
    blurb: 'Từ chạy vặt lên tới chủ tịch. Càng nhiều ca lương càng cao.',
  },
  {
    icon: '🏡',
    name: 'Nhà, xe, thú cưng',
    blurb: 'Nhà cộng tiền điểm danh, xe rút thời gian chờ, chó giữ nhà đuổi trộm.',
  },
  {
    icon: '🏦',
    name: 'Ngân hàng',
    blurb: 'Xu để trong két thì trộm không mò tới được. Muốn cược phải rút ra.',
  },
  {
    icon: '🦹',
    name: 'Trộm cắp và nhà tù',
    blurb: 'Móc túi bạn bè. Xui thì bóc lịch, tái phạm trong ngày phạt nặng dần.',
  },
  {
    icon: '💰',
    name: 'Vay nóng và đòi nợ',
    blurb: 'Vay được bao nhiêu tuỳ uy tín. Quỵt thì bị siết nhà, siết xe, đi tù.',
  },
  {
    icon: '💒',
    name: 'Cưới hỏi',
    blurb: 'Cầu hôn, mở tiệc cho cả kênh mừng tiền. Khách nghèo bấm nút ăn chực.',
  },
];

function shell(title: string, description: string, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#0b3b2a">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:image" content="/logo.png">
<link rel="icon" href="/logo.png" type="image/png">
<link rel="apple-touch-icon" href="/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${STYLE}</style></head><body>${body}</body></html>`;
}

function topbar(): string {
  return `<div class="wrap"><div class="topbar">
    <a class="mark" href="/"><img src="/logo.png" alt="" width="44" height="44"><span>Casino Bot</span></a>
    <nav><a href="/#tro-choi">Trò chơi</a><a href="/#doi-song">Đời sống</a><a href="/terms">Điều khoản</a><a href="/privacy">Quyền riêng tư</a></nav>
  </div></div>`;
}

function footer(invite: string): string {
  return `<footer><div class="wrap">
    <div class="foot-row">
      <a class="mark" href="/"><img src="/logo.png" alt="" width="44" height="44"><span>Casino Bot</span></a>
      <div class="foot-links">
        <a href="${invite}">Thêm vào server</a>
        <a href="/terms">Điều khoản</a>
        <a href="/privacy">Quyền riêng tư</a>
      </div>
    </div>
    <p class="foot-note">Sòng bạc ảo dùng xu không có giá trị quy đổi. Chơi cho vui thôi.</p>
  </div></footer>`;
}

function inviteUrl(clientId: string | undefined): string {
  // Read, write, embed, attach, react and rename itself. Nothing destructive.
  return clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=274945395776`
    : '#';
}

const RAIL = `<div class="rail">${'<i></i>'.repeat(9)}</div>`;

export function landingPage(clientId: string | undefined, jackpot: number): string {
  const invite = inviteUrl(clientId);

  return shell(
    'Casino Bot · Sòng bạc Discord tiếng Việt',
    'Bot Discord sòng bạc tiếng Việt: blackjack, tài xỉu, bầu cua, đua ngựa, Ai Là Triệu Phú, kèm cả một cuộc đời để đi làm, mua nhà, cưới hỏi và vay nợ.',
    `${topbar()}

    <header class="hero"><div class="wrap">
        <img class="hero-chip" src="/logo.png" alt="Phỉnh casino, biểu tượng của Casino Bot" width="176" height="176">
      <p class="eyebrow">Bot Discord tiếng Việt</p>
      <h1>Cả một sòng bạc, và <em>cả một cuộc đời</em>, trong server của bạn</h1>
      <p class="lede">Mười trò cược ăn tiền ngay. Rồi đi làm kiếm xu, tậu nhà tậu xe, cưới hỏi,
        trộm cắp, vay nóng và bị dí nợ giữa kênh.</p>

      <div class="ctas">
        <a class="btn btn-gold" href="${invite}">Thêm vào server Discord</a>
        <a class="btn btn-ghost" href="#tro-choi">Xem có gì chơi</a>
      </div>

      <div class="pot">
        <span class="pot-label">Hũ xổ số đang có</span>
        <span class="pot-value">${jackpot.toLocaleString('vi-VN')}</span>
        <span class="pot-note">xu, quay lúc 21h mỗi tối. Trúng số là ẵm cả hũ.</span>
      </div>
    </div></header>

    ${RAIL}

    <section class="band" id="tro-choi"><div class="wrap">
      <div class="band-head">
        <h2>Mười cách để mất tiền</h2>
        <p>Mỗi trò một luật, đều chơi bằng nút bấm ngay trong kênh. Con số ở góc thẻ là thứ định nghĩa trò đó.</p>
      </div>
      <div class="hand">
        ${GAMES.map(
          (g) => `<article class="card">
          <div class="card-index"><em>${g.index}</em><span>${g.suit}</span></div>
          <h3>${g.name}</h3>
          <p>${g.blurb}</p>
          <span class="card-cmd">${g.cmd}</span>
        </article>`,
        ).join('')}
      </div>
    </div></section>

    <section class="band" id="doi-song"><div class="wrap">
      <div class="band-head">
        <h2>Rời khỏi bàn cược thì vẫn còn cuộc đời</h2>
        <p>Thắng bạc chỉ là một cách làm giàu. Phần còn lại của bot là một khu phố nhỏ để sống trong đó.</p>
      </div>
      <div class="life">
        ${LIFE.map(
          (l) => `<div><span>${l.icon}</span><h3>${l.name}</h3><p>${l.blurb}</p></div>`,
        ).join('')}
      </div>
    </div></section>

    <section class="band"><div class="wrap">
      <div class="stats">
        <div><b>10</b><small>trò cược</small></div>
        <div><b>34</b><small>lệnh</small></div>
        <div><b>6</b><small>cấp nghề nghiệp</small></div>
        <div><b>10</b><small>món tài sản</small></div>
      </div>
    </div></section>

    <section class="band"><div class="wrap">
      <div class="band-head"><h2>Bắt đầu trong ba mươi giây</h2></div>
      <div class="steps">
        <div><h3>Mời bot vào server</h3><p>Bấm nút phía trên rồi chọn server bạn có quyền quản lý.</p></div>
        <div><h3>Gõ <code>/help</code></h3><p>Hướng dẫn chia trang, bấm nút để xem từng mảng.</p></div>
        <div><h3>Gõ <code>/daily</code></h3><p>Tân thủ được tặng 1.000 xu. Nhận thêm mỗi ngày rồi vào bàn.</p></div>
      </div>
    </div></section>

    ${RAIL}

    <section class="closer"><div class="wrap">
      <h2>Server của bạn thiếu một sòng bạc</h2>
      <p>Miễn phí, không quảng cáo, không bắt trả tiền mới được chơi.</p>
      <a class="btn btn-gold" href="${invite}">Thêm vào server Discord</a>

      <p class="fineprint">Xu trong bot là tiền ảo, không mua bán và không quy đổi thành tiền thật
        được. Đây là trò chơi giải trí, không phải dịch vụ cờ bạc ăn tiền.</p>
    </div></section>

    ${footer(invite)}`,
  );
}

function legalPage(
  clientId: string | undefined,
  title: string,
  updated: string,
  body: string,
): string {
  return shell(
    `${title} · Casino Bot`,
    `${title} của Casino Bot, bot Discord sòng bạc giải trí tiếng Việt.`,
    `${topbar()}
    <div class="wrap"><article class="paper">
      <h1>${title}</h1>
      <p class="updated">Cập nhật ${updated}</p>
      ${body}
    </article></div>
    ${footer(inviteUrl(clientId))}`,
  );
}

export function termsPage(clientId: string | undefined): string {
  return legalPage(
    clientId,
    'Điều khoản sử dụng',
    '19/08/2026',
    `<p>Khi mời Casino Bot vào server hoặc dùng bất kỳ lệnh nào của bot, bạn đồng ý với các điều khoản dưới đây.</p>

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
      qua Discord.</p>`,
  );
}

export function privacyPage(clientId: string | undefined): string {
  return legalPage(
    clientId,
    'Chính sách quyền riêng tư',
    '19/08/2026',
    `<h2>1. Dữ liệu bot lưu lại</h2>
    <ul>
      <li><strong>ID người dùng Discord</strong>: để gắn ví xu và tiến trình chơi với đúng người.</li>
      <li><strong>ID server và ID kênh</strong>: để hiển thị bảng xếp hạng theo server và chọn kênh đăng bản tin.</li>
      <li><strong>Dữ liệu trò chơi</strong>: số dư, lịch sử giao dịch, vật phẩm, tài sản, nghề nghiệp,
        khoản vay, thống kê thắng thua, tình trạng hôn nhân trong game, tiền án tiền sự trong game.</li>
      <li><strong>Giao dịch nạp tiền</strong>: số tiền, thời điểm, mã giao dịch và nội dung chuyển khoản
        do cổng thanh toán gửi sang, phục vụ đối soát.</li>
    </ul>

    <h2>2. Dữ liệu bot không lưu</h2>
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
      <li><strong>Google Fonts</strong>: phông chữ cho chính trang web này.</li>
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
    <p>Nếu chính sách thay đổi đáng kể, bot sẽ thông báo trong server qua ghi chú cập nhật.</p>`,
  );
}
