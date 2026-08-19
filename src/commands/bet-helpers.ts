import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { formatCoins } from '../embeds/format.js';

/**
 * Anything a game can be started from: a slash command, a button on the
 * pinned lobby, or the modal that button opens.
 */
export type PlayInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction;

/** Debit the bet or reply with an ephemeral error. Returns true when the bet was placed. */
export async function placeBetOrReply(
  interaction: PlayInteraction,
  bet: number,
  game: string,
): Promise<boolean> {
  if (economy.debit(interaction.user.id, bet, 'bet', game)) return true;
  await interaction.reply({
    content: `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(interaction.user.id))}. Dùng \`/daily\` để nhận xu miễn phí mỗi ngày.`,
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

export function resultLine(payout: number, bet: number): string {
  if (payout === 0) return `💸 **Bạn thua!** Mất ${formatCoins(bet)}`;
  if (payout === bet) return `🤝 **Hoàn tiền!** Nhận lại ${formatCoins(bet)}`;
  return `🎉 **Bạn thắng!** +${formatCoins(payout - bet)}`;
}
