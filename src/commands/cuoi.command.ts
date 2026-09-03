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
import { economy, figurines, gifs, items } from '../context.js';
import { DIVORCE_FEE } from '../services/economy.service.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { announce } from '../interactions/announce.js';
import { refuseIfDown } from '../interactions/downtime.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { CEREMONY_COST, startCeremony } from './honle.command.js';
import type { Command } from './types.js';

// Pending proposals keyed by proposer id (one at a time each).
const proposals = new Map<string, { targetId: string; expiresAt: number }>();
const PROPOSAL_TTL_MS = 5 * 60 * 1000;

/** Who this player is attached to right now, if anyone. */
function partnerOf(userId: string): { label: string; isFigurine: boolean } | null {
  const spouse = economy.spouseOf(userId);
  if (spouse) return { label: `<@${spouse}>`, isFigurine: false };
  const fig = figurines.spouse(userId);
  if (fig) return { label: `**${fig.emoji} ${fig.name}**`, isFigurine: true };
  return null;
}

function marriagePanel(userId: string, displayName: string): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const partner = partnerOf(userId);
  const rings = items.count(userId, 'nhan');

  const embed = new EmbedBuilder()
    .setColor(partner ? COLORS.gold : COLORS.push)
    .setTitle(partner ? '💍 Chuyện gia đình' : '🕊️ Độc thân vui tính')
    .setDescription(
      partner
        ? [
            `**${displayName}** đang là vợ/chồng của ${partner.label}.`,
            '',
            `💒 Mở tiệc cưới mời cả kênh: ${formatCoins(CEREMONY_COST)}, khách mừng tiền lại cho bạn.`,
            `💔 Ly hôn: phí ${formatCoins(DIVORCE_FEE)}, nghĩ kỹ đi.`,
          ].join('\n')
        : [
            `**${displayName}** chưa có ai.`,
            '',
            `Muốn cầu hôn người thật thì gõ \`/cuoi nguoi:@ai đó\`, nhớ mua ${SHOP_ITEMS.nhan.emoji} Nhẫn cầu hôn (${formatCoins(SHOP_ITEMS.nhan.price)}) trong \`/tuido\` trước.`,
            `Nhẫn trong túi: **${rings}**`,
            '',
            'Ngại bị từ chối thì cưới hình nộm cũng được: `/hinhnom`.',
          ].join('\n'),
    );

  if (!partner) return { embeds: [embed], components: [] };

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('wed', 'party'))
          .setLabel('Tổ chức hôn lễ')
          .setEmoji('💒')
          .setStyle(ButtonStyle.Success)
          .setDisabled(economy.getBalance(userId) < CEREMONY_COST),
        new ButtonBuilder()
          .setCustomId(componentId('wed', 'divorce'))
          .setLabel('Ly hôn')
          .setEmoji('💔')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

async function propose(
  interaction: ChatInputCommandInteraction,
  targetId: string,
  targetName: string,
  targetIsBot: boolean,
): Promise<void> {
  const proposer = interaction.user;
  const deny = async (content: string): Promise<void> => {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  };

  if (targetIsBot) {
    await deny('Bot không biết yêu đâu!');
    return;
  }
  if (economy.spouseOf(proposer.id)) {
    await deny('Bạn đang có gia đình rồi! Muốn đi bước nữa thì `/cuoi` rồi bấm 💔 Ly hôn trước.');
    return;
  }
  if (figurines.spouse(proposer.id)) {
    await deny('Bạn đang là vợ/chồng của hình nộm rồi. Chia tay trong `/hinhnom` trước đã!');
    return;
  }
  if (figurines.spouse(targetId)) {
    await deny(`**${targetName}** đã kết hôn với hình nộm của họ rồi, khó chen chân lắm!`);
    return;
  }
  if (economy.spouseOf(targetId)) {
    await deny(`**${targetName}** đã có chủ rồi, đừng phá hoại hạnh phúc gia đình người ta!`);
    return;
  }
  if (items.count(proposer.id, 'nhan') < 1) {
    await deny(
      `Cầu hôn tay không à? Mua ${SHOP_ITEMS.nhan.emoji} Nhẫn cầu hôn trong \`/tuido\` (${formatCoins(SHOP_ITEMS.nhan.price)}) trước đã!`,
    );
    return;
  }

  proposals.set(proposer.id, { targetId, expiresAt: Date.now() + PROPOSAL_TTL_MS });
  await interaction.reply({
    content: `<@${targetId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle('💍 Màn cầu hôn công khai!')
        .setDescription(
          `**${proposer.displayName}** quỳ gối trao nhẫn cho **${targetName}**:\n\n"Về chung một nhà với anh/em nhé?" 🥺\n\nKèo này hết hạn sau 5 phút.`,
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('wed', 'yes', proposer.id))
          .setLabel('Đồng ý 💕')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(componentId('wed', 'no', proposer.id))
          .setLabel('Từ chối')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { users: [targetId] },
  });
}

export const cuoiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cuoi')
    .setDescription('Cầu hôn ai đó, hoặc mở bảng chuyện gia đình của bạn')
    .addUserOption((o) =>
      o.setName('nguoi').setDescription('Người bạn muốn cầu hôn').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi');
    if (target && target.id !== interaction.user.id) {
      await propose(interaction, target.id, target.displayName, target.bot);
      return;
    }
    if (target) {
      await interaction.reply({
        content: 'Yêu bản thân là tốt, nhưng không cưới được.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      ...marriagePanel(interaction.user.id, interaction.user.displayName),
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function acceptProposal(
  interaction: ButtonInteraction,
  proposerId: string,
): Promise<void> {
  // The ring must still be in the proposer's bag, both still single.
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
  const gif = await gifs.get('dance');
  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('💒 HÔN LỄ TRĂM NĂM 💒')
    .setDescription(
      [
        `🎊 Xin chúc mừng <@${proposerId}> và <@${interaction.user.id}> đã chính thức về chung một nhà!`,
        '',
        '💍 Nhẫn đã trao, giấy đã ký, cả sòng bạc làm chứng.',
        'Muốn đãi cả kênh thì mở tiệc bằng `/cuoi` rồi bấm 💒 Tổ chức hôn lễ.',
      ].join('\n'),
    );
  if (gif) embed.setImage(gif);
  await interaction.editReply({
    content: `💒 <@${proposerId}> ❤️ <@${interaction.user.id}>`,
    embeds: [embed],
    components: [],
    allowedMentions: { users: [proposerId, interaction.user.id] },
  });
}

export const weddingComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [action, proposerId] = args;
    const userId = interaction.user.id;

    if (action === 'party') {
      if (await refuseIfDown(interaction)) return;
      await interaction.update(marriagePanel(userId, interaction.user.displayName));
      let outcome: Awaited<ReturnType<typeof startCeremony>> | 'failed';
      try {
        outcome = await startCeremony(
          userId,
          interaction.user.displayName,
          interaction.user.displayAvatarURL(),
          async (payload) => {
          const message = await announce(interaction, payload);
          if (!message) throw new Error('channel unavailable');
          return message;
        });
      } catch (error) {
        console.error('[cuoi] Ceremony failed to open:', error);
        // The booking fee was already taken by the time sending failed.
        economy.credit(userId, CEREMONY_COST, 'refund', 'honle');
        outcome = 'failed';
      }
      if (outcome !== 'ok') {
        await interaction.followUp({
          content:
            outcome === 'single'
              ? 'Chưa cưới ai mà đòi làm đám cưới?'
              : outcome === 'busy'
                ? 'Tiệc cưới của bạn đang diễn ra mà!'
                : outcome === 'poor'
                  ? `Không đủ ${formatCoins(CEREMONY_COST)} để đặt tiệc. Cưới xin tốn kém lắm!`
                  : 'Bot không gửi được tin vào kênh này, đã hoàn lại tiền đặt tiệc.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // Balance changed, so the panel's disabled states are stale.
      await interaction.editReply(marriagePanel(userId, interaction.user.displayName));
      return;
    }

    if (action === 'divorce') {
      const figurine = figurines.spouse(userId);
      if (figurine) {
        figurines.setMarried(userId, false);
        await interaction.update(marriagePanel(userId, interaction.user.displayName));
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.push)
              .setDescription(
                `💔 **${interaction.user.displayName}** đã ly hôn với **${figurine.emoji} ${figurine.name}**. Hình nộm vẫn nằm trong tủ, chỉ là hết duyên thôi.`,
              ),
          ],
        });
        return;
      }
      const result = economy.divorce(userId);
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
      await interaction.update(marriagePanel(userId, interaction.user.displayName));
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setDescription(
              `💔 **${interaction.user.displayName}** và <@${result.ex}> đã chính thức ly hôn. Phí thủ tục ${formatCoins(DIVORCE_FEE)} đã thanh toán.`,
            ),
        ],
        allowedMentions: { parse: [] },
      });
      return;
    }

    // Proposal answer.
    if (action !== 'yes' && action !== 'no') return;
    const proposal = proposals.get(proposerId);
    if (!proposal || proposal.expiresAt < Date.now()) {
      proposals.delete(proposerId);
      await interaction.reply({
        content: 'Màn cầu hôn này đã hết hạn.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (userId !== proposal.targetId) {
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
            .setDescription(
              `**${interaction.user.displayName}** đã từ chối. Nhẫn vẫn còn, tình thì bay.`,
            ),
        ],
        components: [],
      });
      return;
    }
    await acceptProposal(interaction, proposerId);
  },
};
