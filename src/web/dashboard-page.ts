/** Self-contained dashboard UI: no build step, no CDN, no external assets. */
export const LOGIN_PAGE = (error?: string): string => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Casino Bot · Đăng nhập</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0f1115;
         color:#e8eaed; font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  form { background:#171a21; padding:32px; border-radius:16px; width:min(92vw,380px);
         border:1px solid #262a33; }
  h1 { margin:0 0 4px; font-size:22px; }
  p.sub { margin:0 0 24px; color:#8b93a1; font-size:14px; }
  label { display:block; margin:14px 0 6px; font-size:13px; color:#b6bdc9; }
  input { width:100%; padding:11px 13px; border-radius:9px; border:1px solid #2d323d;
          background:#0f1115; color:#e8eaed; font-size:15px; }
  input:focus { outline:2px solid #f1c40f88; border-color:#f1c40f; }
  button { width:100%; margin-top:22px; padding:12px; border:0; border-radius:9px;
           background:#f1c40f; color:#111; font-weight:700; font-size:15px; cursor:pointer; }
  .err { margin-top:16px; padding:10px 12px; border-radius:9px; background:#3a1d1d;
         color:#ff9b9b; font-size:14px; }
</style></head><body>
<form method="post" action="/dashboard/login">
  <h1>🎰 Casino Bot</h1>
  <p class="sub">Bảng điều khiển quản trị</p>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required>
  <label for="password">Mật khẩu</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Đăng nhập</button>
  ${error ? `<div class="err">${error}</div>` : ''}
</form></body></html>`;

export const DASHBOARD_PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Casino Bot · Dashboard</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0f1115; color:#e8eaed;
         font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  header { display:flex; align-items:center; gap:16px; padding:16px 24px;
           border-bottom:1px solid #262a33; position:sticky; top:0; background:#0f1115ee;
           backdrop-filter:blur(8px); flex-wrap:wrap; }
  header h1 { font-size:18px; margin:0; }
  header .spacer { flex:1; }
  a.logout, button.refresh { padding:7px 13px; border-radius:8px; border:1px solid #2d323d;
        background:#171a21; color:#b6bdc9; text-decoration:none; font-size:13px; cursor:pointer; }
  main { padding:24px; max-width:1200px; margin:0 auto; }
  .cards { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
           margin-bottom:26px; }
  .card { background:#171a21; border:1px solid #262a33; border-radius:14px; padding:16px 18px; }
  .card .label { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#8b93a1; }
  .card .value { font-size:24px; font-weight:700; margin-top:6px; }
  .card .value.gold { color:#f1c40f; }
  .card .value.green { color:#57f287; }
  nav { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  nav button { padding:8px 15px; border-radius:999px; border:1px solid #2d323d; background:#171a21;
               color:#b6bdc9; cursor:pointer; font-size:14px; }
  nav button.active { background:#f1c40f; color:#111; border-color:#f1c40f; font-weight:600; }
  .panel { background:#171a21; border:1px solid #262a33; border-radius:14px; overflow:auto; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { padding:10px 14px; text-align:left; white-space:nowrap; }
  th { background:#1d212a; color:#8b93a1; font-size:12px; text-transform:uppercase;
       letter-spacing:.04em; position:sticky; top:0; }
  tr + tr td { border-top:1px solid #232833; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  .pos { color:#57f287; } .neg { color:#ff7b7b; } .muted { color:#8b93a1; }
  .empty { padding:28px; text-align:center; color:#8b93a1; }
</style></head><body>
<header>
  <h1>🎰 Casino Bot Dashboard</h1>
  <div class="spacer"></div>
  <button class="refresh" onclick="loadAll()">Làm mới</button>
  <a class="logout" href="/dashboard/logout">Đăng xuất</a>
</header>
<main>
  <div class="cards" id="cards"></div>
  <nav id="tabs"></nav>
  <div class="panel" id="panel"><div class="empty">Đang tải…</div></div>
</main>
<script>
const fmt = (n) => (n ?? 0).toLocaleString('vi-VN');
const when = (s) => s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'))
  .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : '';
const short = (id) => id ? '…' + String(id).slice(-6) : '';

const TABS = [
  { key:'players', label:'Người chơi', cols:[
      ['userId','ID', v=>short(v)], ['balance','Ví',fmt,'num'], ['bank','Két',fmt,'num'],
      ['cash','Tiền nạp (đ)',fmt,'num'], ['games','Ván',fmt,'num'],
      ['won','Thắng',fmt,'num'], ['lost','Thua',fmt,'num'], ['streak','Streak',fmt,'num'],
      ['joined','Tham gia',when] ] },
  { key:'games', label:'Theo trò', cols:[
      ['game','Trò'], ['bets','Lượt',fmt,'num'], ['staked','Tiền cược',fmt,'num'],
      ['paid','Trả thưởng',fmt,'num'],
      ['rtp','RTP', (_,r)=> r.staked ? (r.paid/r.staked*100).toFixed(1)+'%' : '-', 'num'] ] },
  { key:'transactions', label:'Giao dịch', cols:[
      ['at','Thời gian',when], ['userId','Người',v=>short(v)], ['type','Loại'],
      ['meta','Chi tiết',v=>v??''], ['amount','Số tiền',fmt,'num'] ] },
  { key:'topups', label:'Nạp tiền', cols:[
      ['at','Thời gian',when], ['userId','Người',v=>v?short(v):'chưa khớp'],
      ['code','Mã',v=>v??'—'], ['content','Nội dung CK',v=>(v??'').slice(0,60)],
      ['amount','Số tiền (đ)',fmt,'num'] ] },
  { key:'guilds', label:'Server', cols:[
      ['guildId','Guild',v=>short(v)], ['players','Người chơi',fmt,'num'],
      ['reportEnabled','Bản tin',v=>v?'Bật':'Tắt'], ['hour','Giờ',v=>v==null?'-':v+'h'],
      ['patchVersion','Patch',v=>v??'—'] ] },
];
let current = 'players';

async function api(path) {
  const res = await fetch('/dashboard/api/' + path);
  if (res.status === 401) { location.href = '/dashboard'; return null; }
  return res.json();
}

function renderCards(o) {
  const items = [
    ['Người chơi', fmt(o.players), ''],
    ['Hoạt động 24h', fmt(o.activePlayers24h), ''],
    ['Xu lưu hành', fmt(o.wallet + o.bank), 'gold'],
    ['Doanh thu nạp', fmt(o.revenueVnd) + 'đ', 'green'],
    ['Tiền nạp chưa tiêu', fmt(o.cashHeld) + 'đ', ''],
    ['Lượt cược 24h', fmt(o.bets24h), ''],
    ['Cược 24h', fmt(o.staked24h), ''],
    ['Jackpot', fmt(o.jackpot), 'gold'],
  ];
  document.getElementById('cards').innerHTML = items.map(([l,v,c]) =>
    '<div class="card"><div class="label">'+l+'</div><div class="value '+c+'">'+v+'</div></div>').join('');
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(t =>
    '<button class="'+(t.key===current?'active':'')+'" onclick="switchTab(\\''+t.key+'\\')">'+t.label+'</button>').join('');
}

function renderTable(tab, rows) {
  if (!rows || !rows.length) {
    document.getElementById('panel').innerHTML = '<div class="empty">Chưa có dữ liệu.</div>';
    return;
  }
  const head = '<tr>' + tab.cols.map(c => '<th>'+c[1]+'</th>').join('') + '</tr>';
  const body = rows.map(r => '<tr>' + tab.cols.map(c => {
    const raw = r[c[0]];
    const val = c[2] ? c[2](raw, r) : (raw ?? '');
    const cls = [c[3] === 'num' ? 'num' : '',
                 (c[0] === 'amount' && raw < 0) ? 'neg' : (c[0] === 'amount' ? 'pos' : '')]
                 .filter(Boolean).join(' ');
    return '<td class="'+cls+'">'+val+'</td>';
  }).join('') + '</tr>').join('');
  document.getElementById('panel').innerHTML = '<table>'+head+body+'</table>';
}

async function switchTab(key) {
  current = key;
  renderTabs();
  const tab = TABS.find(t => t.key === key);
  document.getElementById('panel').innerHTML = '<div class="empty">Đang tải…</div>';
  renderTable(tab, await api(key));
}

async function loadAll() {
  const o = await api('overview');
  if (o) renderCards(o);
  await switchTab(current);
}
loadAll();
</script></body></html>`;
