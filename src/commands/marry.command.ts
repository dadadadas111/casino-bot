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
import { economy, items } from '../context.js';
import { DIVORCE_FEE } from '../services/economy.service.js';
import { fetchActionGif } from '../services/gif.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

// Pending proposals keyed by proposer id (one at a time each).
const proposals = new Map<string, { targetId: string; expiresAt: number }>();
const PROPOSAL_TTL_MS = 5 * 60 * 1000;

export const cauhonCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cauhon')
    .setDescription('Cầu hôn một người (cần có 💍 Nhẫn cầu hôn trong túi đồ)')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người ấy').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const proposer = interaction.user;
    const target = interaction.options.getUser('nguoi', true);

    if (target.bot || target.id === proposer.id) {
      await interaction.reply({
        content: target.bot ? 'Bot không biết yêu đâu!' : 'Yêu bản thân là tốt, nhưng không cưới được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (economy.spouseOf(proposer.id)) {
      await interaction.reply({
        content: 'Bạn đang có gia đình rồi! Muốn đi bước nữa thì `/lyhon` trước.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (economy.spouseOf(target.id)) {
      await interaction.reply({
        content: `**${target.displayName}** đã có chủ rồi, đừng phá hoại hạnh phúc gia đình người ta!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (items.count(proposer.id, 'nhan') < 1) {
      await interaction.reply({
        content: 'Cầu hôn tay không à? Mua 💍 Nhẫn cầu hôn trong `/shop` (10.000 xu) trước đã!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    proposals.set(proposer.id, { targetId: target.id, expiresAt: Date.now() + PROPOSAL_TTL_MS });
    await interaction.reply({
      content: `<@${target.id}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('💍 Màn cầu hôn công khai!')
          .setDescription(
            `**${proposer.displayName}** quỳ gối trao nhẫn cho **${target.displayName}**:\n\n"Về chung một nhà với anh/em nhé?" 🥺\n\nKèo này hết hạn sau 5 phút.`,
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(componentId('wed', proposer.id, 'yes'))
            .setLabel('Đồng ý 💕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(componentId('wed', proposer.id, 'no'))
            .setLabel('Từ chối')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      allowedMentions: { users: [target.id] },
    });
  },
};

export const lyhonCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lyhon')
    .setDescription(`Ly hôn (phí ${DIVORCE_FEE.toLocaleString('vi-VN')} xu, nghĩ kỹ đi)`),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const result = economy.divorce(interaction.user.id);
    if (!result.ok) {
      await interaction.reply({
        content:
          result.reason === 'single'
            ? 'Bạn còn độc thân mà đòi ly hôn cái gì?'
            : `Không đủ ${formatCoins(DIVORCE_FEE)} phí ly hôn. Nghèo thì gắng sống chung vậy!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.push)
          .setTitle('💔 Đường ai nấy đi')
          .setDescription(
            `**${interaction.user.displayName}** và <@${result.ex}> đã chính thức ly hôn. Phí thủ tục ${formatCoins(DIVORCE_FEE)} đã thanh toán.`,
          ),
      ],
      allowedMentions: { parse: [] },
    });
  },
};

export const weddingComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [proposerId, action] = args;
    const proposal = proposals.get(proposerId);

    if (!proposal || proposal.expiresAt < Date.now()) {
      proposals.delete(proposerId);
      await interaction.reply({
        content: 'Màn cầu hôn này đã hết hạn.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (interaction.user.id !== proposal.targetId) {
      await interaction.reply({
        content: 'Người ta cầu hôn người khác, bấm hộ làm gì!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    proposals.delete(proposerId);

    if (action === 'no') {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setTitle('💔 Lời từ chối')
            .setDescription(`**${interaction.user.displayName}** đã từ chối. Nhẫn vẫn còn, tình thì bay.`),
        ],
        components: [],
      });
      return;
    }

    // Accept: the ring must still be in the proposer's bag, both still single.
    if (!items.consume(proposerId, 'nhan')) {
      await interaction.update({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setDescription('Éo le: chiếc nhẫn đã biến mất khỏi túi người cầu hôn. Hôn lễ hủy bỏ!'),
        ],
        components: [],
      });
      return;
    }
    if (!economy.marry(proposerId, interaction.user.id)) {
      items.add(proposerId, 'nhan'); // give the ring back
      await interaction.update({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.lose)
            .setDescription('Một trong hai người vừa kết hôn với người khác. Drama quá!'),
        ],
        components: [],
      });
      return;
    }

    await interaction.deferUpdate();
    const gif = await fetchActionGif('dance');
    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle('💒 HÔN LỄ TRĂM NĂM 💒')
      .setDescription(
        [
          `🎊 Xin chúc mừng <@${proposerId}> và <@${interaction.user.id}> đã chính thức về chung một nhà!`,
          '',
          '💍 Nhẫn đã trao, giấy đã ký, cả sòng bạc làm chứng.',
          'Chúc hai bạn trăm năm hạnh phúc, cùng nhau... thắng xu nhà cái! 🎰',
        ].join('\n'),
      );
    if (gif) embed.setImage(gif);
    await interaction.editReply({
      content: `💒 <@${proposerId}> ❤️ <@${interaction.user.id}>`,
      embeds: [embed],
      components: [],
      allowedMentions: { users: [proposerId, interaction.user.id] },
    });
  },
};
