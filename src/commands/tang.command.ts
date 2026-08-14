import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { items } from '../context.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

export const tangCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tang')
    .setDescription('Tặng vật phẩm trong túi đồ cho người khác')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('mon')
        .setDescription('Món muốn tặng')
        .setRequired(true)
        .addChoices(
          ...Object.values(SHOP_ITEMS).map((i) => ({ name: `${i.emoji} ${i.name}`, value: i.key })),
        ),
    )
    .addIntegerOption((o) =>
      o.setName('soluong').setDescription('Số lượng (mặc định 1)').setRequired(false).setMinValue(1),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi', true);
    const key = interaction.options.getString('mon', true);
    const qty = interaction.options.getInteger('soluong') ?? 1;
    const item = SHOP_ITEMS[key];

    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({
        content: target.bot ? 'Bot không nhận quà đâu!' : 'Tự tặng mình thì có gì vui?',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!items.transfer(interaction.user.id, target.id, key, qty)) {
      await interaction.reply({
        content: `Bạn không đủ ${item.emoji} **${item.name}** để tặng (đang có ${items.count(interaction.user.id, key)}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `<@${target.id}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🎁 Có quà nè!')
          .setDescription(
            [
              `**${interaction.user.displayName}** vừa tặng **${target.displayName}**`,
              `${item.emoji} **${item.name}** x${qty}`,
              '',
              `-# ${item.desc}`,
            ].join('\n'),
          ),
      ],
      allowedMentions: { users: [target.id] },
    });
  },
};
