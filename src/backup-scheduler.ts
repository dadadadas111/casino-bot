import { AttachmentBuilder, EmbedBuilder, type Client } from 'discord.js';
import { env } from './config/env.js';
import { backups } from './context.js';
import { MAX_UPLOAD_BYTES } from './services/backup.service.js';
import { vnHour } from './services/lottery.service.js';
import { vnDay } from './services/economy.service.js';
import { COLORS } from './embeds/format.js';

const CHECK_INTERVAL_MS = 60_000;

function human(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Build and post one snapshot. Returns the message that went out, if any. */
export async function runBackup(client: Client, reason: string): Promise<string> {
  if (!env.BACKUP_CHANNEL_ID) return 'BACKUP_CHANNEL_ID chưa cấu hình';

  const channel = await client.channels.fetch(env.BACKUP_CHANNEL_ID).catch(() => null);
  if (!channel?.isSendable()) return 'Không gửi được vào kênh backup (kênh sai hoặc thiếu quyền)';

  const file = backups.snapshot();
  if (file.data.length > MAX_UPLOAD_BYTES) {
    const msg = `Bản backup ${human(file.data.length)} vượt giới hạn tải lên của Discord`;
    console.warn(`[backup] ${msg}`);
    return msg;
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('💾 Sao lưu dữ liệu')
        .setDescription(
          [
            `Ngày: **${vnDay(new Date())}** (${reason})`,
            `Nội dung: ${backups.summary()}`,
            `Kích thước: ${human(file.data.length)} nén, ${human(file.rawBytes)} gốc`,
            '',
            '-# Tải file về, giải nén bằng `gunzip`, mở bằng bất kỳ trình đọc SQLite nào.',
          ].join('\n'),
        ),
    ],
    files: [new AttachmentBuilder(file.data, { name: file.name })],
  });
  backups.markRun();
  console.log(`[backup] Đã gửi ${file.name} (${human(file.data.length)})`);
  return `Đã gửi ${file.name} (${human(file.data.length)})`;
}

export function startBackupScheduler(client: Client): void {
  if (!env.BACKUP_CHANNEL_ID) {
    console.log('[backup] BACKUP_CHANNEL_ID chưa đặt, bỏ qua sao lưu tự động');
    return;
  }
  setInterval(() => {
    void (async () => {
      try {
        const now = new Date();
        if (vnHour(now) < env.BACKUP_HOUR) return;
        if (backups.lastRunDay() === vnDay(now)) return;
        // Mark first so a failing upload cannot retry every minute all day.
        backups.markRun(now);
        await runBackup(client, 'tự động hằng ngày');
      } catch (error) {
        console.error('[backup] thất bại:', error);
      }
    })();
  }, CHECK_INTERVAL_MS);
  console.log(`[backup] Sao lưu tự động lúc ${env.BACKUP_HOUR}h mỗi ngày`);
}
