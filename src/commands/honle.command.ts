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
import { economy, figurines } from '../context.js';
import { fetchActionGif } from '../services/gif.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import type { Command } from './types.js';

export const CEREMONY_COST = 5_000;
export const GIFT_AMOUNT = 500;
const CEREMONY_MS = 5 * 60 * 1000;

interface Guest {
  name: string;
  gifted: boolean;
}

interface Ceremony {
  hostId: string;
  hostName: string;
  /** A real player's id, or null when the partner is a figurine. */
  spouseId: string | null;
  spouseLabel: string;
  guests: Map<string, Guest>;
  giftTotal: number;
  message: Message | null;
  endsAt: number;
}

// One ceremony per host at a time.
const ceremonies = new Map<string, Ceremony>();

function ceremonyEmbed(c: Ceremony, gif: string | null, closed = false): EmbedBuilder {
  const all = [...c.guests.values()];
  const shown = all.slice(0, closed ? 20 : 15);
  const overflow = all.length - shown.length;
  // While the party runs, keep it compact; at closing time read out the book.
  const guestList =
    all.length === 0
      ? closed
        ? 'Không một ai tới. Buồn thật sự. 🥲'
        : 'Chưa có khách nào tới dự.'
      : closed
        ? shown
            .map((g) => (g.gifted ? `🎁 **${g.name}**` : `🥢 **${g.name}** (ăn chực)`))
            .join('\n') + (overflow > 0 ? `\n… và ${overflow} người nữa` : '')
        : shown.map((g) => `${g.gifted ? '🎁' : '🥢'} ${g.name}`).join(', ') +
          (overflow > 0 ? ` và ${overflow} người nữa` : '');
  const freeloaders = all.filter((g) => !g.gifted).length;
  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(closed ? '💒 Hôn lễ đã kết thúc' : '💒 HÔN LỄ ĐANG DIỄN RA 💒')
    .setDescription(
      [
        `Hôm nay, <@${c.hostId}> và ${c.spouseLabel} tổ chức tiệc cưới tại sòng bạc!`,
        '',
        closed
          ? `Tiệc tàn, cỗ hết. Cảm ơn **${c.guests.size}** vị khách đã tới chung vui (kể cả mấy người tới cho có mặt).`
          : `🎁 Mừng cưới ${formatCoins(GIFT_AMOUNT)}, hoặc 🥢 bấm ăn chực nếu túi rỗng, miễn là có mặt! Tiệc tan <t:${Math.floor(c.endsAt / 1000)}:R>.`,
      ].join('\n'),
    )
    .addFields(
      { name: '🎁 Tiền mừng nhận được', value: formatCoins(c.giftTotal), inline: true },
      {
        name: '👥 Khách dự',
        value: `${c.guests.size} (${freeloaders} ăn chực)`,
        inline: true,
      },
      { name: closed ? '📖 Sổ ghi lễ' : 'Danh sách khách', value: guestList },
    );
  if (gif) embed.setImage(gif);
  return embed;
}

async function closeCeremony(hostId: string): Promise<void> {
  const c = ceremonies.get(hostId);
  if (!c) return;
  ceremonies.delete(hostId);
  try {
    await c.message?.edit({ embeds: [ceremonyEmbed(c, null, true)], components: [] });
  } catch (error) {
    console.error('[honle] Failed to close ceremony:', error);
  }
}

export const honleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('honle')
    .setDescription(
      `Tổ chức hôn lễ cho hai vợ chồng (phí ${CEREMONY_COST.toLocaleString('vi-VN')} xu, khách mừng tiền)`,
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hostId = interaction.user.id;
    const spouseId = economy.spouseOf(hostId);
    const figurine = spouseId ? null : figurines.spouse(hostId);

    if (!spouseId && !figurine) {
      await interaction.reply({
        content:
          'Chưa cưới ai mà đòi làm đám cưới? Dùng `/cauhon`, hoặc `/hinhnom cuoi` nếu bạn thích tự lực cánh sinh!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const spouseLabel = spouseId ? `<@${spouseId}>` : `**${figurine!.emoji} ${figurine!.name}**`;
    if (ceremonies.has(hostId)) {
      await interaction.reply({
        content: 'Tiệc cưới của bạn đang diễn ra mà!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!economy.debit(hostId, CEREMONY_COST, 'wedding_cost')) {
      await interaction.reply({
        content: `Không đủ ${formatCoins(CEREMONY_COST)} để đặt tiệc. Cưới xin tốn kém lắm!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ceremony: Ceremony = {
      hostId,
      hostName: interaction.user.displayName,
      spouseId,
      spouseLabel,
      guests: new Map(),
      giftTotal: 0,
      message: null,
      endsAt: Date.now() + CEREMONY_MS,
    };
    ceremonies.set(hostId, ceremony);

    await interaction.deferReply();
    const gif = await fetchActionGif('dance');
    await interaction.editReply({
      content: `@here Tiệc cưới của <@${hostId}> và ${spouseLabel}! 🎉`,
      embeds: [ceremonyEmbed(ceremony, gif)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(componentId('hl', hostId, 'gift'))
            .setLabel(`Mừng cưới ${GIFT_AMOUNT.toLocaleString('vi-VN')} xu`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(componentId('hl', hostId, 'attend'))
            .setLabel('Ăn chực')
            .setEmoji('🥢')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      allowedMentions: {
        parse: ['everyone'],
        users: spouseId ? [hostId, spouseId] : [hostId],
      },
    });
    ceremony.message = await interaction.fetchReply();
    setTimeout(() => void closeCeremony(hostId), CEREMONY_MS);
  },
};

export const honleComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [hostId, action] = args;
    const ceremony = ceremonies.get(hostId);

    if (!ceremony) {
      await interaction.reply({
        content: 'Tiệc cưới này đã tan rồi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const guestId = interaction.user.id;
    if (guestId === ceremony.hostId || guestId === ceremony.spouseId) {
      await interaction.reply({
        content: 'Cô dâu chú rể tự mừng tiền mình thì kỳ lắm!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = ceremony.guests.get(guestId);
    // Attending first then gifting is fine; gifting twice is not.
    if (existing?.gifted || (existing && action === 'attend')) {
      await interaction.reply({
        content: existing.gifted
          ? 'Bạn mừng cưới rồi, tham gì nữa!'
          : 'Đang ăn chực rồi còn đòi suất nữa à!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'attend') {
      ceremony.guests.set(guestId, { name: interaction.user.displayName, gifted: false });
      await interaction.update({
        embeds: [ceremonyEmbed(ceremony, interaction.message.embeds[0]?.image?.url ?? null)],
      });
      return;
    }

    if (!economy.debit(guestId, GIFT_AMOUNT, 'wedding_gift', hostId)) {
      await interaction.reply({
        content: `Không đủ ${formatCoins(GIFT_AMOUNT)} để mừng cưới. Thôi bấm 🥢 **Ăn chực** đi, cô dâu chú rể không đuổi đâu!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Split the gift between the couple, host keeps the odd xu.
    const half = Math.floor(GIFT_AMOUNT / 2);
    economy.credit(ceremony.hostId, GIFT_AMOUNT - half, 'wedding_gift', guestId);
    // A figurine has no wallet, so the whole gift goes to the host.
    if (ceremony.spouseId) {
      economy.credit(ceremony.spouseId, half, 'wedding_gift', guestId);
    } else {
      economy.credit(ceremony.hostId, half, 'wedding_gift', guestId);
    }
    ceremony.guests.set(guestId, { name: interaction.user.displayName, gifted: true });
    ceremony.giftTotal += GIFT_AMOUNT;

    await interaction.update({ embeds: [ceremonyEmbed(ceremony, interaction.message.embeds[0]?.image?.url ?? null)] });
  },
};
