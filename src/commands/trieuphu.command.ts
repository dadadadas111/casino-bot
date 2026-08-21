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

import { assets, economy, quizPool } from '../context.js';
import { env } from '../config/env.js';
import {
  type GameQuestion,
  LADDER,
  QUESTION_COUNT,
  buildGameQuestions,
  safeAmount,
  stopPrize,
  wrongPrize,
} from '../services/trieuphu.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

const QUESTION_TIME_MS = 30_000;
const LETTERS = ['🇦', '🇧', '🇨', '🇩'];

interface QuizSession {
  userId: string;
  username: string;
  questions: GameQuestion[];
  index: number; // current question; equals the number of correct answers so far
  /** 50:50 lifelines left; a 🦜 Vẹt buys a second one. */
  fiftyLeft: number;
  removed: number[]; // answer indices removed by 50:50 on the current question
  message: Message | null;
  timeout: NodeJS.Timeout;
}

const sessions = new Map<string, QuizSession>();
// Users whose question set is still being generated (blocks double-start).
const pending = new Set<string>();

/**
 * Draw from the shared pool, which hands out questions this server has not
 * seen and refills itself in the background. Generating per game was the
 * single largest running cost; the static bank still covers a pool outage.
 */
async function prepareQuestions(guildId: string | null): Promise<GameQuestion[]> {
  if (guildId) {
    const fromPool = await quizPool.drawGame(guildId);
    if (fromPool) return fromPool;
  }
  return buildGameQuestions();
}

function questionEmbed(session: QuizSession): EmbedBuilder {
  const q = session.questions[session.index];
  const lines = q.answers.map((answer, i) =>
    session.removed.includes(i) ? `~~${LETTERS[i]} ${answer}~~` : `${LETTERS[i]} ${answer}`,
  );
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle(`💰 Ai Là Triệu Phú · Câu ${session.index + 1}/${QUESTION_COUNT}`)
    .setDescription(`**${q.question}**\n\n${lines.join('\n')}`)
    .addFields(
      { name: 'Trả lời đúng nhận', value: formatCoins(LADDER[session.index]), inline: true },
      { name: 'Mốc an toàn', value: formatCoins(safeAmount(session.index)), inline: true },
      { name: 'Dừng thì giữ', value: formatCoins(stopPrize(session.index)), inline: true },
    )
    .setFooter({
      text: `${session.username} · 30 giây mỗi câu · Sai rơi về mốc an toàn (câu 5 và câu 10)`,
    });
}

function buttons(session: QuizSession): ActionRowBuilder<ButtonBuilder>[] {
  const answerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ['A', 'B', 'C', 'D'].map((letter, i) =>
      new ButtonBuilder()
        .setCustomId(componentId('tp', session.userId, 'ans', String(i)))
        .setLabel(letter)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(session.removed.includes(i)),
    ),
  );
  const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('tp', session.userId, 'stop'))
      .setLabel(`Dừng (giữ ${stopPrize(session.index).toLocaleString('vi-VN')} xu)`)
      .setEmoji('🛑')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(componentId('tp', session.userId, 'half'))
      .setLabel(session.fiftyLeft > 1 ? `50:50 (còn ${session.fiftyLeft})` : '50:50')
      .setEmoji('✂️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.fiftyLeft <= 0),
  );
  return [answerRow, controlRow];
}

function endSession(session: QuizSession): void {
  clearTimeout(session.timeout);
  sessions.delete(session.userId);
}

type EndKind = 'win' | 'wrong' | 'stop' | 'timeout';

function finalEmbed(session: QuizSession, kind: EndKind, chosen?: number): EmbedBuilder {
  const q = session.questions[Math.min(session.index, QUESTION_COUNT - 1)];
  const prize =
    kind === 'win'
      ? LADDER[QUESTION_COUNT - 1]
      : kind === 'wrong'
        ? wrongPrize(session.index)
        : stopPrize(session.index);

  const headline =
    kind === 'win'
      ? `🎉🎉 **TRIỆU PHÚ!** Vượt qua cả ${QUESTION_COUNT} câu hỏi!`
      : kind === 'wrong'
        ? `❌ Sai mất rồi! Đáp án đúng: **${q.answers[q.correct]}**${chosen !== undefined ? ` (bạn chọn ${q.answers[chosen]})` : ''}`
        : kind === 'timeout'
          ? '⏰ Hết giờ! Tự động dừng cuộc chơi.'
          : '🛑 Bạn chọn dừng cuộc chơi an toàn.';

  economy.settleGame(session.userId, 0, prize, 'trieuphu');

  return new EmbedBuilder()
    .setColor(kind === 'win' ? COLORS.gold : kind === 'wrong' ? COLORS.lose : COLORS.push)
    .setTitle('💰 Ai Là Triệu Phú: Kết thúc')
    .setDescription(
      [
        headline,
        `Trả lời đúng: **${session.index}/${QUESTION_COUNT}** câu`,
        `Tiền thưởng: **${formatCoins(prize)}**`,
        `Số dư mới: ${formatCoins(economy.getBalance(session.userId))}`,
      ].join('\n'),
    )
    .setFooter({ text: `${session.username} · Ghế nóng mở lại sau 15 phút` });
}

function armTimer(session: QuizSession): void {
  clearTimeout(session.timeout);
  session.timeout = setTimeout(() => {
    void (async () => {
      if (!sessions.has(session.userId)) return;
      const embed = finalEmbed(session, 'timeout');
      endSession(session);
      try {
        await session.message?.edit({ embeds: [embed], components: [] });
      } catch (error) {
        console.error('[trieuphu] Failed to edit message on timeout:', error);
      }
    })();
  }, QUESTION_TIME_MS);
}

export const trieuphuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('trieuphu')
    .setDescription('Ai Là Triệu Phú: 15 câu hỏi, tối đa 100.000 xu, chơi lại sau mỗi 15 phút'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await runTrieuPhu(interaction);
  },
};

/** Shared by the slash command and the lobby button. */
export async function runTrieuPhu(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
    const userId = interaction.user.id;

    if (sessions.has(userId) || pending.has(userId)) {
      await interaction.reply({
        content: 'Bạn đang trong ghế nóng rồi, chơi nốt ván hiện tại đã!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!economy.canPlayQuiz(userId)) {
      const readyUnix = Math.floor(economy.quizReadyAt(userId).getTime() / 1000);
      await interaction.reply({
        content: `⏳ Ghế nóng cần dọn lại! Vào ván tiếp theo <t:${readyUnix}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    pending.add(userId);
    try {
      economy.markQuizPlayed(userId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.playing)
            .setTitle('💰 Ai Là Triệu Phú')
            .setDescription(
              `🎬 **${interaction.user.displayName}** bước vào ghế nóng!\nĐang soạn bộ câu hỏi riêng cho ván này, chờ vài giây...`,
            ),
        ],
      });

      const questions = await prepareQuestions(interaction.inGuild() ? interaction.guildId : null);

      const session: QuizSession = {
        userId,
        username: interaction.user.displayName,
        questions,
        index: 0,
        fiftyLeft: assets.has(userId, 'vet') ? 2 : 1,
        removed: [],
        message: null,
        timeout: setTimeout(() => undefined, 0),
      };
      sessions.set(userId, session);
      armTimer(session);

      await interaction.editReply({
        embeds: [questionEmbed(session)],
        components: buttons(session),
      });
      session.message = await interaction.fetchReply();
    } finally {
      pending.delete(userId);
    }
}

export const trieuphuComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [ownerId, action, arg] = args;

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'Ghế nóng này của người khác. Dùng `/trieuphu` để tự chơi nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }


    const session = sessions.get(ownerId);
    if (!session) {
      await interaction.reply({
        content: 'Ván chơi này đã kết thúc.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'half') {
      if (session.fiftyLeft <= 0) {
        await interaction.reply({
          content: 'Hết lượt 50:50 rồi. Mua 🦜 Vẹt trong `/tuido` để có thêm một lượt mỗi ván.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const q = session.questions[session.index];
      const wrongIndices = [0, 1, 2, 3].filter((i) => i !== q.correct);
      // Remove two random wrong answers.
      wrongIndices.sort(() => Math.random() - 0.5);
      session.removed = wrongIndices.slice(0, 2);
      session.fiftyLeft -= 1;
      await interaction.update({ embeds: [questionEmbed(session)], components: buttons(session) });
      return;
    }

    if (action === 'stop') {
      const embed = finalEmbed(session, 'stop');
      endSession(session);
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // answer
    const chosen = Number(arg);
    const q = session.questions[session.index];
    if (chosen !== q.correct) {
      const embed = finalEmbed(session, 'wrong', chosen);
      endSession(session);
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    session.index += 1;
    if (session.index === QUESTION_COUNT) {
      const embed = finalEmbed(session, 'win');
      endSession(session);
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    session.removed = [];
    armTimer(session);
    await interaction.update({ embeds: [questionEmbed(session)], components: buttons(session) });
  },
};

/**
 * A quiz interrupted by a restart costs no prize, but the player already
 * spent their one game of the day, so hand the daily attempt back.
 */
export function refundPendingQuizzes(): number {
  let restored = 0;
  for (const session of sessions.values()) {
    clearTimeout(session.timeout);
    economy.resetCooldown(session.userId, 'trieuphu');
    restored++;
  }
  sessions.clear();
  pending.clear();
  return restored;
}
