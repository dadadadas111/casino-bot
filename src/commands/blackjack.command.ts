import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  SlashCommandBuilder,
} from 'discord.js';
import { economy } from '../context.js';
import {
  type Card,
  type BlackjackOutcome,
  blackjackPayout,
  compareHands,
  createShuffledDeck,
  dealerPlay,
  formatHand,
  handValue,
  isBlackjack,
  isBust,
} from '../services/blackjack.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { PlayInteraction } from './bet-helpers.js';
import type { Command } from './types.js';

const GAME_TIMEOUT_MS = 120_000;

interface BlackjackSession {
  userId: string;
  username: string;
  avatarUrl: string;
  bet: number; // per-hand bet; doubled games settle with bet * 2
  doubled: boolean;
  deck: Card[];
  player: Card[];
  dealer: Card[];
  message: Message | null;
  timeout: NodeJS.Timeout;
}

const sessions = new Map<string, BlackjackSession>();

function outcomeText(outcome: BlackjackOutcome, payout: number, totalBet: number): string {
  switch (outcome) {
    case 'blackjack':
      return `🎉 **BLACKJACK!** Bạn thắng ${formatCoins(payout - totalBet)} (tỷ lệ 3:2)`;
    case 'win':
      return `🎉 **Bạn thắng!** +${formatCoins(payout - totalBet)}`;
    case 'push':
      return `🤝 **Hòa!** Hoàn lại tiền cược ${formatCoins(totalBet)}`;
    case 'lose':
      return `💸 **Bạn thua!** Mất ${formatCoins(totalBet)}`;
  }
}

function playingEmbed(session: BlackjackSession): EmbedBuilder {
  const totalBet = session.doubled ? session.bet * 2 : session.bet;
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle('🃏 Blackjack')
    .setThumbnail(session.avatarUrl)
    .setDescription(`Người chơi: **${session.username}** | Tiền cược: **${formatCoins(totalBet)}**`)
    .addFields(
      {
        name: `Bài của bạn (${handValue(session.player)} điểm)`,
        value: formatHand(session.player),
        inline: false,
      },
      {
        name: 'Bài nhà cái (? điểm)',
        value: formatHand(session.dealer, true),
        inline: false,
      },
    )
    .setFooter({ text: 'Rút: thêm bài | Dừng: so bài | Gấp đôi: x2 cược, rút đúng 1 lá' });
}

function finalEmbed(
  session: BlackjackSession,
  outcome: BlackjackOutcome,
  payout: number,
): EmbedBuilder {
  const totalBet = session.doubled ? session.bet * 2 : session.bet;
  const color =
    outcome === 'push' ? COLORS.push : payout > totalBet ? COLORS.win : COLORS.lose;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 Blackjack: Kết quả')
    .setThumbnail(session.avatarUrl)
    .setDescription(outcomeText(outcome, payout, totalBet))
    .addFields(
      {
        name: `Bài của bạn (${handValue(session.player)} điểm)`,
        value: formatHand(session.player),
        inline: false,
      },
      {
        name: `Bài nhà cái (${handValue(session.dealer)} điểm)`,
        value: formatHand(session.dealer),
        inline: false,
      },
      {
        name: 'Số dư mới',
        value: formatCoins(economy.getBalance(session.userId)),
        inline: false,
      },
    )
    .setFooter({ text: `Người chơi: ${session.username}` });
}

function buttons(session: BlackjackSession): ActionRowBuilder<ButtonBuilder>[] {
  const canDouble =
    session.player.length === 2 &&
    !session.doubled &&
    economy.getBalance(session.userId) >= session.bet;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('bj', session.userId, 'hit'))
      .setLabel('Rút bài')
      .setEmoji('🎴')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(componentId('bj', session.userId, 'stand'))
      .setLabel('Dừng')
      .setEmoji('✋')
      .setStyle(ButtonStyle.Success),
  );
  if (canDouble) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('bj', session.userId, 'double'))
        .setLabel('Gấp đôi')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Danger),
    );
  }
  return [row];
}

function endSession(session: BlackjackSession): void {
  clearTimeout(session.timeout);
  sessions.delete(session.userId);
}

/** Settle and return the final embed (caller decides how to render it). */
function settle(session: BlackjackSession, outcome: BlackjackOutcome): EmbedBuilder {
  const totalBet = session.doubled ? session.bet * 2 : session.bet;
  const payout = blackjackPayout(outcome, totalBet);
  economy.settleGame(session.userId, totalBet, payout, 'blackjack');
  endSession(session);
  return finalEmbed(session, outcome, payout);
}

async function autoStandOnTimeout(userId: string): Promise<void> {
  const session = sessions.get(userId);
  if (!session) return;
  dealerPlay(session.deck, session.dealer);
  const outcome = isBust(session.player) ? 'lose' : compareHands(session.player, session.dealer);
  const embed = settle(session, outcome).setFooter({
    text: `Người chơi: ${session.username} | Hết giờ, tự động dừng sau 2 phút`,
  });
  try {
    await session.message?.edit({ embeds: [embed], components: [] });
  } catch (error) {
    console.error('[blackjack] Failed to edit message on timeout:', error);
  }
}

export const blackjackCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Chơi blackjack với nhà cái (trả 3:2 khi có blackjack)')
    .addIntegerOption((o) =>
      o
        .setName('cuoc')
        .setDescription('Số xu muốn cược')
        .setRequired(true)
        .setMinValue(10),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await runBlackjack(interaction, interaction.options.getInteger('cuoc', true));
  },
};

/** Shared by the slash command and the lobby button. */
export async function runBlackjack(interaction: PlayInteraction, bet: number): Promise<void> {
    const userId = interaction.user.id;

    if (sessions.has(userId)) {
      await interaction.reply({
        content: 'Bạn đang có một ván blackjack chưa kết thúc. Chơi xong ván đó đã nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!economy.debit(userId, bet, 'bet', 'blackjack')) {
      await interaction.reply({
        content: `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(userId))}. Dùng \`/daily\` để nhận xu miễn phí mỗi ngày.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deck = createShuffledDeck();
    const session: BlackjackSession = {
      userId,
      username: interaction.user.displayName,
      avatarUrl: interaction.user.displayAvatarURL(),
      bet,
      doubled: false,
      deck,
      player: [deck.pop()!, deck.pop()!],
      dealer: [deck.pop()!, deck.pop()!],
      message: null,
      timeout: setTimeout(() => void autoStandOnTimeout(userId), GAME_TIMEOUT_MS),
    };
    sessions.set(userId, session);

    // Natural blackjack resolves immediately.
    if (isBlackjack(session.player)) {
      const outcome: BlackjackOutcome = isBlackjack(session.dealer) ? 'push' : 'blackjack';
      const embed = settle(session, outcome);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    await interaction.reply({ embeds: [playingEmbed(session)], components: buttons(session) });
    session.message = await interaction.fetchReply();
  
}


export const blackjackComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [ownerId, action] = args;

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'Đây không phải ván bài của bạn. Dùng `/blackjack` để mở ván riêng nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const session = sessions.get(ownerId);
    if (!session) {
      await interaction.reply({
        content: 'Ván bài này đã kết thúc hoặc hết hạn.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'hit') {
      session.player.push(session.deck.pop()!);
      if (isBust(session.player)) {
        const embed = settle(session, 'lose');
        await interaction.update({ embeds: [embed], components: [] });
        return;
      }
      if (handValue(session.player) === 21) {
        dealerPlay(session.deck, session.dealer);
        const embed = settle(session, compareHands(session.player, session.dealer));
        await interaction.update({ embeds: [embed], components: [] });
        return;
      }
      await interaction.update({
        embeds: [playingEmbed(session)],
        components: buttons(session),
      });
      return;
    }

    if (action === 'double') {
      if (session.player.length !== 2 || session.doubled) {
        await interaction.reply({
          content: 'Chỉ được gấp đôi khi đang cầm đúng 2 lá bài.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!economy.debit(session.userId, session.bet, 'bet', 'blackjack')) {
        await interaction.reply({
          content: 'Không đủ xu để gấp đôi tiền cược.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.doubled = true;
      session.player.push(session.deck.pop()!);
      if (isBust(session.player)) {
        const embed = settle(session, 'lose');
        await interaction.update({ embeds: [embed], components: [] });
        return;
      }
      dealerPlay(session.deck, session.dealer);
      const embed = settle(session, compareHands(session.player, session.dealer));
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    if (action === 'stand') {
      dealerPlay(session.deck, session.dealer);
      const embed = settle(session, compareHands(session.player, session.dealer));
      await interaction.update({ embeds: [embed], components: [] });
    }
  },
};

/**
 * Refund every stake still sitting in memory. Called on shutdown so a deploy
 * never swallows a bet that was debited but never settled.
 */
export function refundPendingBlackjack(): number {
  let refunded = 0;
  for (const session of sessions.values()) {
    clearTimeout(session.timeout);
    const totalBet = session.doubled ? session.bet * 2 : session.bet;
    economy.credit(session.userId, totalBet, 'refund', 'blackjack');
    refunded++;
  }
  sessions.clear();
  return refunded;
}
