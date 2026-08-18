import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { quizReview } from '../context.js';
import { env } from '../config/env.js';
import type { PendingReview } from '../services/quiz-pool.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS } from '../embeds/format.js';

const LETTERS = ['🇦', '🇧', '🇨', '🇩'];

function reviewEmbed(item: PendingReview, remaining: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('🔍 Duyệt câu hỏi nghi trùng')
    .setDescription(
      [
        `**Câu mới:**\n${item.question}`,
        item.answers.map((a, i) => `${LETTERS[i]} ${a}${i === item.correct ? ' ✅' : ''}`).join('\n'),
        '',
        `**Bị nghi trùng với:**\n${item.matchedQuestion}`,
        '',
        `Độ giống: **${Math.round(item.score * 100)}%** · Độ khó: **${item.tier}**`,
      ].join('\n'),
    )
    .setFooter({ text: `Còn ${remaining} câu chờ duyệt` });
}

function reviewButtons(key: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('rev', 'ok', key))
        .setLabel('Giữ lại')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(componentId('rev', 'no', key))
        .setLabel('Đúng là trùng, bỏ')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(componentId('rev', 'skip', key))
        .setLabel('Để sau')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function ownerOnly(userId: string): boolean {
  return Boolean(env.BOT_OWNER_ID) && userId === env.BOT_OWNER_ID;
}

export async function showNext(
  respond: (payload: {
    embeds?: EmbedBuilder[];
    components?: ActionRowBuilder<ButtonBuilder>[];
    content?: string;
  }) => Promise<unknown>,
  skipKey?: string,
): Promise<void> {
  const item = await quizReview.next();
  const next = item && item.key === skipKey ? null : item;
  if (!next) {
    await respond({
      content: '✅ Hết câu chờ duyệt rồi!',
      embeds: [],
      components: [],
    });
    return;
  }
  const remaining = await quizReview.count();
  await respond({ embeds: [reviewEmbed(next, remaining)], components: reviewButtons(next.key) });
}

export const reviewComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [action, key] = args;
    if (!ownerOnly(interaction.user.id)) {
      await interaction.reply({
        content: 'Chỉ chủ bot duyệt được câu hỏi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    if (action === 'ok') await quizReview.approve(key);
    if (action === 'no') await quizReview.reject(key);
    // "skip" leaves the entry in place and just moves past it this round.
    await showNext((payload) => interaction.editReply(payload), action === 'skip' ? key : undefined);
  },
};
