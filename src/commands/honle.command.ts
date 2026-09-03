import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type BaseMessageOptions,
  type ButtonInteraction,
  type Client,
  type Message,
} from 'discord.js';
import { economy, figurines } from '../context.js';
import { gifs } from '../context.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { userAvatar } from '../embeds/wedding.js';

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
  hostAvatar: string;
  /** A real player's id, or null when the partner is a figurine. */
  spouseId: string | null;
  spouseLabel: string;
  /** The partner's avatar (figurine photo or real user), shown at the ceremony. */
  spouseAvatar: string | null;
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
  // The couple's faces: host on the byline, figurine avatar as the thumbnail.
  embed.setAuthor({ name: c.hostName, iconURL: c.hostAvatar });
  if (c.spouseAvatar) embed.setThumbnail(c.spouseAvatar);
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

export type CeremonyOutcome = 'ok' | 'single' | 'busy' | 'poor';

/**
 * Book and open a wedding party. The caller supplies `send` so the party can
 * be launched from a slash command or from a button on an ephemeral panel.
 */
export async function startCeremony(
  hostId: string,
  hostName: string,
  hostAvatar: string,
  client: Client,
  send: (payload: BaseMessageOptions) => Promise<Message>,
): Promise<CeremonyOutcome> {
  const spouseId = economy.spouseOf(hostId);
  const figurine = spouseId ? null : figurines.spouse(hostId);
  if (!spouseId && !figurine) return 'single';
  if (ceremonies.has(hostId)) return 'busy';
  if (!economy.debit(hostId, CEREMONY_COST, 'wedding_cost')) return 'poor';

  const spouseLabel = spouseId ? `<@${spouseId}>` : `**${figurine!.emoji} ${figurine!.name}**`;
  const spouseAvatar = figurine ? figurine.avatar : await userAvatar(client, spouseId!);
  const ceremony: Ceremony = {
    hostId,
    hostName,
    hostAvatar,
    spouseId,
    spouseLabel,
    spouseAvatar,
    guests: new Map(),
    giftTotal: 0,
    message: null,
    endsAt: Date.now() + CEREMONY_MS,
  };
  ceremonies.set(hostId, ceremony);

  const gif = await gifs.get('dance');
  ceremony.message = await send({
    // No @here: a 5.000 xu command must not be able to ping the whole server.
    content: `🎉 Tiệc cưới của <@${hostId}> và ${spouseLabel}!`,
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
    allowedMentions: { users: spouseId ? [hostId, spouseId] : [hostId] },
  });
  setTimeout(() => void closeCeremony(hostId), CEREMONY_MS);
  return 'ok';
}

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

/** A party cut short by a restart gets its booking fee back. */
export function refundPendingWeddings(): number {
  let refunded = 0;
  for (const ceremony of ceremonies.values()) {
    economy.credit(ceremony.hostId, CEREMONY_COST, 'refund', 'honle');
    refunded++;
  }
  ceremonies.clear();
  return refunded;
}
