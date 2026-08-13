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
  spouseId: string;
  guests: Map<string, Guest>;
  giftTotal: number;
  message: Message | null;
  endsAt: number;
}

// One ceremony per host at a time.
const ceremonies = new Map<string, Ceremony>();

function ceremonyEmbed(c: Ceremony, gif: string | null, closed = false): EmbedBuilder {
  const shown = [...c.guests.values()].slice(0, 15);
  const guestList =
    c.guests.size > 0
      ? shown.map((g) => `${g.gifted ? '🎁' : '🥂'} ${g.name}`).join(', ') +
        (c.guests.size > 15 ? ` và ${c.guests.size - 15} người nữa` : '')
      : 'Chưa có khách nào tới dự.';
  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(closed ? '💒 Hôn lễ đã kết thúc' : '💒 HÔN LỄ ĐANG DIỄN RA 💒')
    .setDescription(
      [
        `Hôm nay, <@${c.hostId}> và <@${c.spouseId}> tổ chức tiệc cưới tại sòng bạc!`,
        '',
        closed
          ? `Cảm ơn **${c.guests.size}** vị khách đã tới chung vui.`
          : `🎁 Mừng cưới ${formatCoins(GIFT_AMOUNT)}, hoặc 🥂 dự tiệc tay không cũng được, miễn là có mặt! Tiệc tan <t:${Math.floor(c.endsAt / 1000)}:R>.`,
      ].join('\n'),
    )
    .addFields(
      { name: '🎁 Tiền mừng nhận được', value: formatCoins(c.giftTotal), inline: true },
      { name: '👥 Khách dự', value: `${c.guests.size}`, inline: true },
      { name: 'Danh sách khách', value: guestList },
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

    if (!spouseId) {
      await interaction.reply({
        content: 'Chưa cưới ai mà đòi làm đám cưới? Dùng `/cauhon` trước đã!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
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
      guests: new Map(),
      giftTotal: 0,
      message: null,
      endsAt: Date.now() + CEREMONY_MS,
    };
    ceremonies.set(hostId, ceremony);

    await interaction.deferReply();
    const gif = await fetchActionGif('dance');
    await interaction.editReply({
      content: `@here Tiệc cưới của <@${hostId}> và <@${spouseId}>! 🎉`,
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
            .setLabel('Dự tiệc (miễn phí)')
            .setEmoji('🥂')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      allowedMentions: { parse: ['everyone'], users: [hostId, spouseId] },
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
        content: existing.gifted ? 'Bạn mừng cưới rồi, tham gì nữa!' : 'Bạn đang ở trong tiệc rồi!',
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
        content: `Không đủ ${formatCoins(GIFT_AMOUNT)} để mừng cưới. Bấm 🥂 dự tiệc tay không cũng được, cô dâu chú rể không giận đâu!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Split the gift between the couple, host keeps the odd xu.
    const half = Math.floor(GIFT_AMOUNT / 2);
    economy.credit(ceremony.hostId, GIFT_AMOUNT - half, 'wedding_gift', guestId);
    economy.credit(ceremony.spouseId, half, 'wedding_gift', guestId);
    ceremony.guests.set(guestId, { name: interaction.user.displayName, gifted: true });
    ceremony.giftTotal += GIFT_AMOUNT;

    await interaction.update({ embeds: [ceremonyEmbed(ceremony, interaction.message.embeds[0]?.image?.url ?? null)] });
  },
};
