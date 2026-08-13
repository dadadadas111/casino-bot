import { createServer } from 'node:http';
import { EmbedBuilder, type Client } from 'discord.js';
import { env } from './config/env.js';
import { topups } from './context.js';
import { COLORS } from './embeds/format.js';
import { formatVnd } from './commands/cash.command.js';

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Webhook endpoint for SePay bank-transfer notifications.
 * SePay requires HTTP 200/201 with {"success": true} inside 30 seconds,
 * otherwise it retries up to seven times.
 */
export function startSepayServer(client: Client): void {
  if (!env.SEPAY_API_KEY) {
    console.log('[sepay] SEPAY_API_KEY not set, webhook server disabled');
    return;
  }

  const server = createServer((req, res) => {
    const reply = (status: number, body: unknown): void => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.url === '/health') {
      reply(200, { ok: true });
      return;
    }
    if (req.method !== 'POST' || !req.url?.startsWith('/webhook/sepay')) {
      reply(404, { success: false });
      return;
    }

    const auth = req.headers.authorization ?? '';
    if (auth !== `Apikey ${env.SEPAY_API_KEY}`) {
      console.warn('[sepay] Rejected webhook with bad Authorization header');
      reply(401, { success: false });
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      void (async () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const result = topups.handleWebhook(payload);
          console.log(`[sepay] ${JSON.stringify(result)}`);

          if (result.action === 'credited') {
            try {
              const user = await client.users.fetch(result.userId);
              await user.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(COLORS.win)
                    .setTitle('💵 Nạp tiền thành công!')
                    .setDescription(
                      [
                        `Đã nhận **${formatVnd(result.amount)}** cho mã \`${result.code}\`.`,
                        'Gõ `/cash xem` để kiểm tra số dư, hoặc `/trieuphu` để reset ghế nóng ngay.',
                      ].join('\n'),
                    ),
                ],
              });
            } catch (error) {
              console.warn(`[sepay] Could not DM ${result.userId}: ${String(error)}`);
            }
          }
          reply(200, { success: true });
        } catch (error) {
          console.error('[sepay] Webhook processing failed:', error);
          // Report failure so SePay retries rather than dropping the payment.
          reply(500, { success: false });
        }
      })();
    });
  });

  server.listen(env.SEPAY_PORT, () => {
    console.log(`[sepay] Webhook server listening on :${env.SEPAY_PORT}`);
  });
}
