import { EmbedBuilder, type Client } from 'discord.js';
import { lottery } from './context.js';
import { COLORS, formatCoins } from './embeds/format.js';

const CHECK_INTERVAL_MS = 60_000;

/** Draws every due lottery day (survives restarts: past days drain first). */
export function startLotteryScheduler(client: Client): void {
  setInterval(() => void checkDraw(client), CHECK_INTERVAL_MS);
}

async function checkDraw(client: Client): Promise<void> {
  try {
    const day = lottery.pendingDrawDay();
    if (!day) return;
    const result = lottery.draw(day);
    console.log(
      `[xoso] Drew ${result.day}: number ${result.number}, ${result.winners.length} winner(s) of ${result.totalTickets} tickets`,
    );

    const numberText = String(result.number).padStart(2, '0');
    const winnerLines =
      result.winners.length > 0
        ? result.winners.map(
            (w) => `🎉 <@${w.userId}> trúng ${w.tickets} vé: **+${formatCoins(w.share)}**`,
          )
        : ['Không ai trúng kỳ này. Jackpot dồn sang mai, càng lúc càng to!'];

    const embed = new EmbedBuilder()
      .setColor(result.winners.length > 0 ? COLORS.gold : COLORS.info)
      .setTitle(`🎱 Kết quả xổ số kỳ ${result.day}`)
      .setDescription(
        [
          `Số trúng thưởng: **${numberText}**`,
          '',
          ...winnerLines,
          '',
          `💰 Jackpot kỳ tới: **${formatCoins(result.jackpotAfter)}** · Mua vé: \`/xoso mua\``,
        ].join('\n'),
      );

    const mentions = result.winners.map((w) => `<@${w.userId}>`).join(' ');
    for (const target of result.announceTargets) {
      try {
        const channel = await client.channels.fetch(target.channelId);
        if (channel?.isSendable()) {
          await channel.send({
            content: mentions || undefined,
            embeds: [embed],
            allowedMentions: { users: result.winners.map((w) => w.userId) },
          });
        }
      } catch (error) {
        console.warn(`[xoso] Cannot announce in channel ${target.channelId}: ${String(error)}`);
      }
    }
  } catch (error) {
    console.error('[xoso] Draw check failed:', error);
  }
}
