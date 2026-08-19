import { EmbedBuilder, type Client } from 'discord.js';
import { assets, loans } from './context.js';
import { ASSETS } from './services/assets.service.js';
import type { SeizeResult } from './services/loan.service.js';
import { COLORS, formatCoins } from './embeds/format.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function seizureEmbed(result: SeizeResult): EmbedBuilder {
  const { loan, owed, recovered, soldAssets, jailedUntil } = result;
  const lines = [
    `Chủ nợ đã mất kiên nhẫn với <@${loan.userId}>. Khoản vay **${formatCoins(loan.principal)}** quá hạn hơn một ngày, tổng phải trả **${formatCoins(owed)}**.`,
    '',
  ];
  if (result.steps.includes('vi')) lines.push('👛 Vét sạch ví.');
  if (result.steps.includes('ket')) lines.push('🏦 Phá két lấy nốt. Két không phải chỗ trốn nợ.');
  if (soldAssets.length > 0) {
    lines.push(
      `🏠 Tịch thu và thanh lý nửa giá: ${soldAssets.map((k) => `${ASSETS[k]?.emoji ?? ''} ${ASSETS[k]?.name ?? k}`).join(', ')}`,
    );
  }
  lines.push('', `Thu hồi được **${formatCoins(recovered)}** trên tổng **${formatCoins(owed)}**.`);
  if (jailedUntil) {
    lines.push(
      `🚔 Vẫn thiếu, nên phần còn lại xóa sổ và con nợ đi bóc lịch tới <t:${Math.floor(jailedUntil.getTime() / 1000)}:R>.`,
      '-# Cả xóm đều biết chuyện này rồi.',
    );
  } else {
    lines.push('✅ Trả đủ, coi như xong nợ. Lần sau nhớ trả đúng hạn.');
  }
  return new EmbedBuilder()
    .setColor(jailedUntil ? COLORS.lose : COLORS.push)
    .setTitle('🚨 SIẾT NỢ')
    .setDescription(lines.join('\n'));
}

/** Post where the loan was taken out, so the shaming lands with the right crowd. */
async function announceSeizure(client: Client, result: SeizeResult): Promise<void> {
  const channelId = result.loan.channelId;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({
      content: `<@${result.loan.userId}>`,
      embeds: [seizureEmbed(result)],
      allowedMentions: { users: [result.loan.userId] },
    });
  } catch (error) {
    console.error('[loan] Failed to announce seizure:', error);
  }
}

export async function collectOverdueLoans(client: Client): Promise<number> {
  const due = loans.defaulted();
  for (const loan of due) {
    try {
      const before = assets.owned(loan.userId).length;
      const result = loans.seize(loan);
      console.log(
        `[loan] Seized #${loan.id} from ${loan.userId}: recovered ${result.recovered}/${result.owed}` +
          (before !== assets.owned(loan.userId).length ? ' (bán tài sản)' : ''),
      );
      await announceSeizure(client, result);
    } catch (error) {
      console.error(`[loan] Seizure failed for loan #${loan.id}:`, error);
    }
  }
  return due.length;
}

export function startLoanCollector(client: Client): void {
  const tick = (): void => {
    void collectOverdueLoans(client).catch((error) =>
      console.error('[loan] Collector tick failed:', error),
    );
  };
  setInterval(tick, CHECK_INTERVAL_MS);
  tick();
  console.log('[loan] Đội đòi nợ tuần tra mỗi 5 phút');
}
