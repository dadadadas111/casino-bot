import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
} from 'discord.js';
import { economy } from '../context.js';
import { drawCard, formatCard, type Card } from '../services/cards.js';
import {
  HILO_MAX_STEPS,
  type HiLoChoice,
  cappedTotal,
  drawDifferent,
  isCorrect,
  multiplierFor,
} from '../services/hilo.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { placeBetOrReply, type PlayInteraction } from './bet-helpers.js';
import type { Command } from './types.js';

/** Walk away automatically rather than let a stake sit abandoned. */
const IDLE_MS = 3 * 60 * 1000;

interface Session {
  userId: string;
  username: string;
  bet: number;
  card: Card;
  total: number; // accumulated multiplier
  steps: number;
  message: Message | null;
  timeout: NodeJS.Timeout;
}

const sessions = new Map<string, Session>();

const payoutOf = (s: Session): number => Math.floor(s.bet * cappedTotal(s.total));

function board(session: Session, note: string, color: number): EmbedBuilder {
  const lines = [
    `# ${formatCard(session.card)}`,
    note,
    '',
    `Cược **${formatCoins(session.bet)}** · chuỗi **${session.steps}/${HILO_MAX_STEPS}**`,
  ];
  if (session.steps > 0) {
    lines.push(`Đang giữ **x${cappedTotal(session.total).toFixed(2)}** = **${formatCoins(payoutOf(session))}**`);
  }
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 Cao hay Thấp')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${session.username} · đoán sai là mất sạch, rút lúc nào cũng được` });
}

function controls(session: Session): ActionRowBuilder<ButtonBuilder>[] {
  const up = multiplierFor(session.card.rank, 'cao');
  const down = multiplierFor(session.card.rank, 'thap');
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('hilo', session.userId, 'cao'))
        .setLabel(up === null ? 'Cao hơn (không thể)' : `Cao hơn · x${up.toFixed(2)}`)
        .setEmoji('⬆️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(up === null),
      new ButtonBuilder()
        .setCustomId(componentId('hilo', session.userId, 'thap'))
        .setLabel(down === null ? 'Thấp hơn (không thể)' : `Thấp hơn · x${down.toFixed(2)}`)
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(down === null),
      new ButtonBuilder()
        .setCustomId(componentId('hilo', session.userId, 'rut'))
        .setLabel(session.steps > 0 ? `Rút ${payoutOf(session).toLocaleString('vi-VN')} xu` : 'Rút tiền')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Secondary)
        // Cashing out before guessing would be a free look at the card.
        .setDisabled(session.steps === 0),
    ),
  ];
}

function close(session: Session): void {
  clearTimeout(session.timeout);
  sessions.delete(session.userId);
}

function arm(session: Session): void {
  clearTimeout(session.timeout);
  session.timeout = setTimeout(() => {
    void (async () => {
      if (!sessions.has(session.userId)) return;
      const payout = payoutOf(session);
      economy.settleGame(session.userId, session.bet, payout, 'hilo');
      close(session);
      try {
        await session.message?.edit({
          embeds: [
            board(
              session,
              `⏰ Hết giờ chờ, bot tự rút hộ **${formatCoins(payout)}**.`,
              COLORS.push,
            ),
          ],
          components: [],
        });
      } catch (error) {
        console.error('[hilo] Failed to close idle session:', error);
      }
    })();
  }, IDLE_MS);
}

export const hiloCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hilo')
    .setDescription('Cao hay Thấp: đoán lá kế tiếp, đoán đúng thì nhân tiền, rút lúc nào cũng được')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await runHiLo(interaction, interaction.options.getInteger('cuoc', true));
  },
};

/** Shared by the slash command and the lobby button. */
export async function runHiLo(interaction: PlayInteraction, bet: number): Promise<void> {
    if (sessions.has(interaction.user.id)) {
      await interaction.reply({
        content: 'Bạn đang có một ván Cao Thấp dở dang, chơi nốt đã!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!(await placeBetOrReply(interaction, bet, 'hilo'))) return;

    const session: Session = {
      userId: interaction.user.id,
      username: interaction.user.displayName,
      bet,
      card: drawCard(),
      total: 1,
      steps: 0,
      message: null,
      timeout: setTimeout(() => undefined, 0),
    };
    sessions.set(session.userId, session);

    await interaction.reply({
      embeds: [board(session, 'Lá kế tiếp cao hơn hay thấp hơn?', COLORS.playing)],
      components: controls(session),
    });
    session.message = await interaction.fetchReply();
    arm(session);
}

export const hiloComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [ownerId, action] = args;
    const session = sessions.get(ownerId);
    if (!session) {
      await interaction.reply({ content: 'Ván này kết thúc rồi.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'Ván của người ta, bấm hộ làm gì!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'rut') {
      const payout = payoutOf(session);
      economy.settleGame(session.userId, session.bet, payout, 'hilo');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `💰 Rút về **${formatCoins(payout)}**, lời **${formatCoins(payout - session.bet)}**. Biết dừng đúng lúc!`,
            COLORS.win,
          ),
        ],
        components: [],
      });
      return;
    }

    const choice = action as HiLoChoice;
    const multiplier = multiplierFor(session.card.rank, choice);
    if (multiplier === null) return;

    const previous = session.card;
    const next = drawDifferent(previous.rank);
    const won = isCorrect(previous.rank, next.rank, choice);
    session.card = next;

    if (!won) {
      economy.settleGame(session.userId, session.bet, 0, 'hilo');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `💥 Lá trước là ${formatCard(previous)}, bạn đoán **${choice === 'cao' ? 'cao hơn' : 'thấp hơn'}** nhưng ra ${formatCard(next)}. Mất trắng ${formatCoins(session.bet)}.`,
            COLORS.lose,
          ),
        ],
        components: [],
      });
      return;
    }

    session.total *= multiplier;
    session.steps += 1;

    if (session.steps >= HILO_MAX_STEPS) {
      const payout = payoutOf(session);
      economy.settleGame(session.userId, session.bet, payout, 'hilo');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `🏆 Đủ ${HILO_MAX_STEPS} lá, kịch trần! Bot tự rút **${formatCoins(payout)}** cho bạn.`,
            COLORS.gold,
          ),
        ],
        components: [],
      });
      return;
    }

    arm(session);
    await interaction.update({
      embeds: [
        board(
          session,
          `✅ ${formatCard(previous)} → ${formatCard(next)}, đoán đúng! Rút hay đi tiếp?`,
          COLORS.win,
        ),
      ],
      components: controls(session),
    });
  },
};

/** Hand back every open stake when the process is going down. */
export function refundPendingHilo(): number {
  let refunded = 0;
  for (const session of sessions.values()) {
    clearTimeout(session.timeout);
    economy.credit(session.userId, session.bet, 'refund', 'hilo');
    refunded++;
  }
  sessions.clear();
  return refunded;
}
