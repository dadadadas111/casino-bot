import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from './ids.js';
import { announce } from './announce.js';

export type DowntimeKind = 'jail' | 'hospital';

export interface Downtime {
  kind: DowntimeKind;
  until: Date;
  fee: number;
}

/** Whichever confinement the player is serving right now, with the exit price. */
export function currentDowntime(userId: string, now: Date = new Date()): Downtime | null {
  const jailed = economy.jailedUntil(userId, now);
  if (jailed) return { kind: 'jail', until: jailed, fee: economy.releaseFee(userId, 'jail', now) };
  const admitted = economy.hospitalizedUntil(userId, now);
  if (admitted) {
    return { kind: 'hospital', until: admitted, fee: economy.releaseFee(userId, 'hospital', now) };
  }
  return null;
}

const COPY: Record<DowntimeKind, { icon: string; where: string; button: string }> = {
  jail: { icon: '🚔', where: 'đang ngồi tù', button: 'Nộp phạt' },
  hospital: { icon: '🏥', where: 'đang nằm viện', button: 'Trả viện phí' },
};

export function releaseRow(kind: DowntimeKind, fee: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(componentId('free', kind))
      .setLabel(`${COPY[kind].button} · ${formatCoins(fee)}`)
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * The reply that turns a player away while locked up. The way out rides along
 * as a button so nobody has to know a command name at the worst moment.
 */
export function downtimeReply(downtime: Downtime): {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
  flags: MessageFlags.Ephemeral;
} {
  const { icon, where } = COPY[downtime.kind];
  const at = Math.floor(downtime.until.getTime() / 1000);
  const out = downtime.kind === 'jail' ? 'Ra tù' : 'Xuất viện';
  return {
    content: `${icon} Bạn ${where}, ${out.toLowerCase()} <t:${at}:R>. Muốn ra ngay thì bấm nút bên dưới.`,
    components: [releaseRow(downtime.kind, downtime.fee)],
    flags: MessageFlags.Ephemeral,
  };
}

export const downtimeComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const kind = args[0] as DowntimeKind;
    if (kind !== 'jail' && kind !== 'hospital') return;

    const userId = interaction.user.id;
    const fee = economy.releaseFee(userId, kind);
    const result = kind === 'jail' ? economy.bail(userId) : economy.payMedicalBill(userId);

    if (result === 'not_jailed' || result === 'not_admitted') {
      await interaction.reply({
        content: kind === 'jail' ? 'Bạn ra tù rồi mà!' : 'Bạn xuất viện rồi mà!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (result === 'poor') {
      await interaction.reply({
        content:
          kind === 'jail'
            ? `Không đủ ${formatCoins(fee)} để nộp phạt. Ngồi bóc lịch tiếp thôi!`
            : `Không đủ ${formatCoins(fee)} trả viện phí. Nằm chờ hồi phục tự nhiên vậy!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const times = economy.offenseCount(userId, kind);
    const description =
      kind === 'jail'
        ? `🔓 **${interaction.user.displayName}** đã nộp phạt ${formatCoins(fee)} và được thả tự do.${times > 1 ? ` Lần thứ ${times} trong ngày rồi đấy, lần sau phạt nặng hơn!` : ' Hoàn lương nhé!'}`
        : `🏥 **${interaction.user.displayName}** đã trả ${formatCoins(fee)} viện phí và xuất viện.${times > 1 ? ` Vào viện lần thứ ${times} trong ngày, mua mũ bảo hiểm đi cho đỡ tốn!` : ' Giữ gìn sức khỏe nhé!'}`;

    await interaction.deferUpdate();
    // The private block notice is now stale; a public arrest post is not ours
    // alone to edit, so leave that one alone.
    if (interaction.message.flags.has(MessageFlags.Ephemeral)) {
      await interaction.editReply({ components: [] }).catch(() => undefined);
    }
    await announce(interaction, {
      embeds: [new EmbedBuilder().setColor(COLORS.win).setDescription(description)],
    });
  },
};

/**
 * Guard for panel buttons that move money. Returns true when the action was
 * refused, so callers can bail out.
 */
export async function refuseIfDown(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const downtime = currentDowntime(interaction.user.id);
  if (!downtime) return false;
  await interaction.reply(downtimeReply(downtime));
  return true;
}
