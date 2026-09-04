import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { economy, quests } from '../context.js';
import type { QuestView } from '../services/quest.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

function progressBar(done: number, total: number): string {
  const filled = Math.round((done / total) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function panel(view: QuestView): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const { mission, progress, completed, canReroll, rerollAt } = view;
  const embed = new EmbedBuilder()
    .setColor(completed ? COLORS.gold : COLORS.info)
    .setTitle('🎯 Nhiệm vụ hiện tại')
    .setDescription(
      completed
        ? `${mission.icon} **${mission.text}**\n\n✅ **Hoàn thành!** Bấm nhận **${formatCoins(mission.reward)}**.`
        : [
            `${mission.icon} **${mission.text}**`,
            '',
            `\`${progressBar(progress, mission.target)}\` ${progress}/${mission.target}`,
            `Thưởng: **${formatCoins(mission.reward)}**`,
          ].join('\n'),
    )
    .setFooter({
      text: completed
        ? 'Nhận thưởng xong sẽ có nhiệm vụ mới ngay.'
        : canReroll
          ? 'Không thích thì đổi nhiệm vụ khác.'
          : 'Có thể đổi nhiệm vụ sau 10 phút kể từ khi mở bảng này.',
    });

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (completed) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('quest', 'claim'))
        .setLabel(`Nhận · ${formatCoins(mission.reward)}`)
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success),
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('quest', 'reroll'))
        .setLabel(
          canReroll || !rerollAt
            ? 'Đổi nhiệm vụ'
            : `Đổi được sau ${Math.max(1, Math.ceil((rerollAt.getTime() - Date.now()) / 60000))} phút`,
        )
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canReroll),
    );
  }
  return { embeds: [embed], components: [row] };
}

export const nhiemvuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nhiemvu')
    .setDescription('Xem nhiệm vụ hiện tại, nhận thưởng, hoặc đổi nhiệm vụ khác'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Viewing starts the 10-minute reroll clock.
    const view = quests.view(interaction.user.id);
    await interaction.reply({ ...panel(view), flags: MessageFlags.Ephemeral });
  },
};

export const questComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const userId = interaction.user.id;
    if (args[0] === 'claim') {
      const result = quests.claim(userId);
      if (!result.ok) {
        await interaction.update(panel(quests.view(userId)));
        return;
      }
      await interaction.update(panel(quests.view(userId)));
      await interaction.followUp({
        content: `🎉 Xong nhiệm vụ, +${formatCoins(result.reward ?? 0)}! Số dư: ${formatCoins(economy.getBalance(userId))}. Đã có nhiệm vụ mới.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (args[0] === 'reroll') {
      const result = quests.reroll(userId);
      if (!result.ok) {
        await interaction.reply({
          content: result.rerollAt
            ? `Chưa đổi được, chờ tới <t:${Math.floor(result.rerollAt.getTime() / 1000)}:R>.`
            : 'Chưa đổi được nhiệm vụ này.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update(panel(quests.view(userId)));
    }
  },
};
