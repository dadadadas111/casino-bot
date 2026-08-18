import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EmbedBuilder, type Client } from 'discord.js';
import { env } from './config/env.js';
import { dashboard, quizPool, topups } from './context.js';
import { COLORS } from './embeds/format.js';
import { formatVnd } from './commands/cash.command.js';
import {
  LoginThrottle,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  parseCookies,
  safeEqual,
  verifyPassword,
  verifySession,
} from './web/auth.js';
import { DASHBOARD_PAGE, LOGIN_PAGE } from './web/dashboard-page.js';
import { PRIVACY_PAGE, TERMS_PAGE, landingPage } from './web/landing-page.js';

const MAX_BODY_BYTES = 64 * 1024;
const throttle = new LoginThrottle();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const isString = typeof body === 'string';
  res.writeHead(status, {
    'Content-Type': isString ? 'text/html; charset=utf-8' : 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
}

// ---- SePay ----

function receiptEmbed(amount: number, code: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.win)
    .setTitle('💵 Nạp tiền thành công!')
    .setDescription(
      [
        `Đã nhận **${formatVnd(amount)}** cho mã \`${code}\`.`,
        '`/cash xem` để kiểm tra ví, `/cash doixu` để đổi sang xu, `/trieuphu` để reset ghế nóng.',
      ].join('\n'),
    );
}

/**
 * Post the receipt where the player asked for the top-up. DMs are unreliable
 * (many accounts block messages from non-friends), so the originating channel
 * comes first and the DM is only a fallback.
 */
async function announceTopup(
  client: Client,
  userId: string,
  amount: number,
  code: string,
  channelId: string | null,
): Promise<void> {
  const embed = receiptEmbed(amount, code);

  if (channelId) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isSendable()) {
        await channel.send({
          content: `<@${userId}>`,
          embeds: [embed],
          allowedMentions: { users: [userId] },
        });
        return;
      }
    } catch (error) {
      console.warn(`[sepay] Cannot post receipt in ${channelId}: ${String(error)}`);
    }
  }

  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch (error) {
    console.warn(`[sepay] Could not DM ${userId}: ${String(error)}`);
  }
}

async function handleSepay(req: IncomingMessage, res: ServerResponse, client: Client): Promise<void> {
  if (req.headers.authorization !== `Apikey ${env.SEPAY_API_KEY}`) {
    console.warn('[sepay] Rejected webhook with bad Authorization header');
    send(res, 401, { success: false });
    return;
  }
  try {
    const payload = JSON.parse(await readBody(req));
    const result = topups.handleWebhook(payload);
    console.log(`[sepay] ${JSON.stringify(result)}`);
    if (result.action === 'credited') {
      await announceTopup(client, result.userId, result.amount, result.code, result.channelId);
    }
    send(res, 200, { success: true });
  } catch (error) {
    console.error('[sepay] Webhook processing failed:', error);
    // Report failure so SePay retries rather than dropping the payment.
    send(res, 500, { success: false });
  }
}

// ---- Dashboard ----

function dashboardEnabled(): boolean {
  return Boolean(env.DASHBOARD_EMAIL && env.DASHBOARD_PASSWORD_HASH && env.DASHBOARD_SESSION_SECRET);
}

function sessionEmail(req: IncomingMessage): string | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  return verifySession(token, env.DASHBOARD_SESSION_SECRET!);
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
}

async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ip = clientIp(req);
  const lockedMs = throttle.lockedFor(ip);
  if (lockedMs > 0) {
    send(res, 429, LOGIN_PAGE(`Sai quá nhiều lần, thử lại sau ${Math.ceil(lockedMs / 60000)} phút.`));
    return;
  }

  const form = new URLSearchParams(await readBody(req));
  const email = (form.get('email') ?? '').trim().toLowerCase();
  const password = form.get('password') ?? '';
  const emailOk = safeEqual(email, env.DASHBOARD_EMAIL!.toLowerCase());
  const passOk = verifyPassword(password, env.DASHBOARD_PASSWORD_HASH!);

  if (!emailOk || !passOk) {
    throttle.recordFailure(ip);
    console.warn(`[dashboard] Failed login from ${ip}`);
    send(res, 401, LOGIN_PAGE('Email hoặc mật khẩu không đúng.'));
    return;
  }

  throttle.reset(ip);
  const token = createSession(email, env.DASHBOARD_SESSION_SECRET!);
  send(res, 302, '', {
    Location: '/dashboard',
    'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/dashboard; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`,
  });
}

async function handleDashboardApi(res: ServerResponse, resource: string): Promise<void> {
  if (resource === 'quizpool') {
    send(res, 200, (await quizPool.stats()) ?? { total: 0, byTier: {} });
    return;
  }
  switch (resource) {
    case 'overview':
      send(res, 200, dashboard.overview());
      return;
    case 'players':
      send(res, 200, dashboard.players());
      return;
    case 'transactions':
      send(res, 200, dashboard.transactions());
      return;
    case 'topups':
      send(res, 200, dashboard.topups());
      return;
    case 'games':
      send(res, 200, dashboard.games());
      return;
    case 'guilds':
      send(res, 200, dashboard.guilds());
      return;
    default:
      send(res, 404, { error: 'unknown resource' });
  }
}

async function handleDashboard(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (!dashboardEnabled()) {
    send(res, 404, { error: 'dashboard disabled' });
    return;
  }
  const path = url.pathname.replace(/\/+$/, '') || '/dashboard';

  if (path === '/dashboard/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }
  if (path === '/dashboard/logout') {
    send(res, 302, '', {
      Location: '/dashboard',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/dashboard; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    });
    return;
  }

  const email = sessionEmail(req);
  if (path.startsWith('/dashboard/api/')) {
    if (!email) {
      send(res, 401, { error: 'unauthorised' });
      return;
    }
    await handleDashboardApi(res, path.slice('/dashboard/api/'.length));
    return;
  }
  if (path === '/dashboard') {
    send(res, 200, email ? DASHBOARD_PAGE : LOGIN_PAGE());
    return;
  }
  send(res, 404, { error: 'not found' });
}

// ---- Server ----

export function startWebServer(client: Client): void {

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname === '/health') {
          send(res, 200, { ok: true });
          return;
        }
        // Public pages: what the bot is, plus the legal pages Discord asks
        // for when a bot takes payments.
        if (url.pathname === '/' || url.pathname === '/index.html') {
          send(res, 200, landingPage(env.DISCORD_CLIENT_ID));
          return;
        }
        if (url.pathname === '/terms') {
          send(res, 200, TERMS_PAGE);
          return;
        }
        if (url.pathname === '/privacy') {
          send(res, 200, PRIVACY_PAGE);
          return;
        }
        if (url.pathname === '/invite' && env.DISCORD_CLIENT_ID) {
          send(res, 302, '', {
            Location: `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=277025508352`,
          });
          return;
        }
        if (url.pathname.startsWith('/webhook/sepay') && req.method === 'POST') {
          await handleSepay(req, res, client);
          return;
        }
        if (url.pathname.startsWith('/dashboard')) {
          await handleDashboard(req, res, url);
          return;
        }
        send(res, 404, { error: 'not found' });
      } catch (error) {
        console.error('[web] Request failed:', error);
        if (!res.headersSent) send(res, 500, { error: 'internal error' });
      }
    })();
  });

  server.listen(env.SEPAY_PORT, () => {
    console.log(
      `[web] Listening on :${env.SEPAY_PORT} (landing${env.SEPAY_API_KEY ? ' + sepay webhook' : ''}${dashboardEnabled() ? ' + dashboard' : ''})`,
    );
  });
}
