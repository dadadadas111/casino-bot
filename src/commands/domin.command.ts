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
import {
  MINES_COUNT,
  MINES_SAFE,
  MINES_TILES,
  layMines,
  multiplierAfter,
} from '../services/mines.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { placeBetOrReply, type PlayInteraction } from './bet-helpers.js';
import type { Command } from './types.js';

const IDLE_MS = 3 * 60 * 1000;
const COLUMNS = 4;

interface Session {
  userId: string;
  username: string;
  bet: number;
  mines: number[];
  opened: number[];
  message: Message | null;
  timeout: NodeJS.Timeout;
}

const sessions = new Map<string, Session>();

const payoutOf = (s: Session): number => Math.floor(s.bet * multiplierAfter(s.opened.length));

function board(session: Session, note: string, color: number, reveal = false): EmbedBuilder {
  const left = MINES_SAFE - session.opened.length;
  const lines = [note, ''];
  if (session.opened.length > 0) {
    lines.push(
      `Đang giữ **x${multiplierAfter(session.opened.length).toFixed(2)}** = **${formatCoins(payoutOf(session))}**`,
    );
  }
  lines.push(
    `Cược **${formatCoins(session.bet)}** · mở **${session.opened.length}/${MINES_SAFE}** ô an toàn` +
      (reveal ? '' : ` · còn ${left} ô nữa là ăn trọn`),
  );
  if (!reveal) {
    const next = multiplierAfter(session.opened.length + 1);
    lines.push(`-# Mở thêm một ô nữa thì lên x${next.toFixed(2)}. Có ${MINES_COUNT} quả mìn trong ${MINES_TILES} ô.`);
  }
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('💣 Dò mìn')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${session.username} · dính mìn là mất sạch, rút lúc nào cũng được` });
}

function grid(session: Session, reveal = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let r = 0; r < MINES_TILES / COLUMNS; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < COLUMNS; c++) {
      const tile = r * COLUMNS + c;
      const open = session.opened.includes(tile);
      const mined = session.mines.includes(tile);
      const shown = open || (reveal && mined);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('min', session.userId, String(tile)))
          .setLabel(shown ? '​' : String(tile + 1))
          .setEmoji(open ? '💎' : reveal && mined ? '💣' : '⬜')
          .setStyle(open ? ButtonStyle.Success : reveal && mined ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(reveal || open),
      );
    }
    rows.push(row);
  }
  if (!reveal) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('min', session.userId, 'rut'))
          .setLabel(
            session.opened.length > 0
              ? `Rút ${payoutOf(session).toLocaleString('vi-VN')} xu`
              : 'Rút tiền',
          )
          .setEmoji('💰')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(session.opened.length === 0),
      ),
    );
  }
  return rows;
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
      economy.settleGame(session.userId, session.bet, payout, 'domin');
      close(session);
      try {
        await session.message?.edit({
          embeds: [board(session, `⏰ Hết giờ chờ, bot tự rút hộ **${formatCoins(payout)}**.`, COLORS.push, true)],
          components: grid(session, true),
        });
      } catch (error) {
        console.error('[domin] Failed to close idle session:', error);
      }
    })();
  }, IDLE_MS);
}

export const dominCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('domin')
    .setDescription(`Dò mìn: mở ô ăn tiền, ${MINES_COUNT} quả mìn giấu trong ${MINES_TILES} ô, rút lúc nào cũng được`)
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu muốn cược').setRequired(true).setMinValue(10),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await runDoMin(interaction, interaction.options.getInteger('cuoc', true));
  },
};

/** Shared by the slash command and the lobby button. */
export async function runDoMin(interaction: PlayInteraction, bet: number): Promise<void> {
    if (sessions.has(interaction.user.id)) {
      await interaction.reply({
        content: 'Bạn đang có một bãi mìn dở dang, dò nốt đã!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!(await placeBetOrReply(interaction, bet, 'domin'))) return;

    const session: Session = {
      userId: interaction.user.id,
      username: interaction.user.displayName,
      bet,
      mines: layMines(),
      opened: [],
      message: null,
      timeout: setTimeout(() => undefined, 0),
    };
    sessions.set(session.userId, session);

    await interaction.reply({
      embeds: [board(session, 'Chọn một ô. Đừng chọn nhầm quả mìn.', COLORS.playing)],
      components: grid(session),
    });
    session.message = await interaction.fetchReply();
    arm(session);
}

export const minesComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [ownerId, action] = args;
    const session = sessions.get(ownerId);
    if (!session) {
      await interaction.reply({ content: 'Ván này kết thúc rồi.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'Bãi mìn của người ta, bấm hộ làm gì!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'rut') {
      const payout = payoutOf(session);
      economy.settleGame(session.userId, session.bet, payout, 'domin');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `💰 Rút về **${formatCoins(payout)}**, lời **${formatCoins(payout - session.bet)}**. Mìn còn nằm im ở ${session.mines.map((m) => m + 1).join(', ')}.`,
            COLORS.win,
            true,
          ),
        ],
        components: grid(session, true),
      });
      return;
    }

    const tile = Number(action);
    if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) return;
    if (session.opened.includes(tile)) return;

    if (session.mines.includes(tile)) {
      economy.settleGame(session.userId, session.bet, 0, 'domin');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `💥 Ô số ${tile + 1} có mìn. Mất trắng ${formatCoins(session.bet)}.`,
            COLORS.lose,
            true,
          ),
        ],
        components: grid(session, true),
      });
      return;
    }

    session.opened.push(tile);

    if (session.opened.length >= MINES_SAFE) {
      const payout = payoutOf(session);
      economy.settleGame(session.userId, session.bet, payout, 'domin');
      close(session);
      await interaction.update({
        embeds: [
          board(
            session,
            `🏆 Dọn sạch cả bãi mìn! Ăn trọn **${formatCoins(payout)}**.`,
            COLORS.gold,
            true,
          ),
        ],
        components: grid(session, true),
      });
      return;
    }

    arm(session);
    await interaction.update({
      embeds: [board(session, `💎 Ô số ${tile + 1} an toàn. Tham tiếp hay rút?`, COLORS.win)],
      components: grid(session),
    });
  },
};

export function refundPendingMines(): number {
  let refunded = 0;
  for (const session of sessions.values()) {
    clearTimeout(session.timeout);
    economy.credit(session.userId, session.bet, 'refund', 'domin');
    refunded++;
  }
  sessions.clear();
  return refunded;
}
