import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { quizReview } from '../context.js';
import { env } from '../config/env.js';
import type { PendingReview } from '../services/quiz-pool.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

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

async function showNext(
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

export const duyetcauCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('duyetcau')
    .setDescription('Duyệt các câu hỏi bị nghi trùng (chỉ chủ bot)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!ownerOnly(interaction.user.id)) {
      await interaction.reply({
        content: 'Lệnh này chỉ chủ bot dùng được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!quizReview.available()) {
      await interaction.reply({
        content: 'Kho câu hỏi đang không kết nối được, thử lại sau.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await showNext((payload) => interaction.editReply(payload));
  },
};

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
