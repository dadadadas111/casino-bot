import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type ModalSubmitInteraction,
  type SendableChannels,
} from 'discord.js';
import { economy, luck } from '../context.js';
import {
  HORSE_COUNT,
  NUM_EMOJI,
  TRACK_LEN,
  type Horse,
  generateHorses,
  pickWinner,
  renderTrack,
} from '../services/race.service.js';
import { parseBetToken } from '../services/bet-parse.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import type { Command } from './types.js';

const BETTING_MS = 30_000;
const FRAMES = 8;
const FRAME_MS = 1_300;

interface RaceBet {
  userId: string;
  username: string;
  horse: number;
  amount: number;
}

interface RaceSession {
  channelId: string;
  horses: Horse[];
  bets: Map<string, RaceBet>;
  phase: 'betting' | 'racing';
  message: Message | null;
  endsAt: number;
}

const races = new Map<string, RaceSession>();

function lobbyEmbed(session: RaceSession): EmbedBuilder {
  const endsUnix = Math.floor(session.endsAt / 1000);
  const horsesText = session.horses
    .map((h, i) => `${NUM_EMOJI[i]} **${h.name}** · ăn **x${h.odds}**\n-# ${h.trait}`)
    .join('\n');
  const betsText =
    session.bets.size === 0
      ? 'Chưa có ai đặt cược.'
      : [...session.bets.values()]
          .map((b) => `${NUM_EMOJI[b.horse]} ${b.username} : ${formatCoins(b.amount)}`)
          .join('\n');
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle('🏇 Trường đua mở cửa!')
    .setDescription(
      `Xuất phát <t:${endsUnix}:R>. Ngắm kỹ phong độ rồi bấm nút chọn ngựa (hoặc \`!dn <cược> <1-4>\`).\n\n${horsesText}`,
    )
    .addFields({ name: `Kèo đã đặt (${session.bets.size})`, value: betsText })
    .setFooter({ text: 'Mỗi người một kèo mỗi trận · Tỷ lệ ăn cao = ngựa yếu, liều ăn nhiều' });
}

function betButtons(session: RaceSession, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    session.horses.map((h, i) =>
      new ButtonBuilder()
        .setCustomId(componentId('dn', session.channelId, 'bet', String(i)))
        .setLabel(`${i + 1}. ${h.name} x${h.odds}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    ),
  );
  return [row];
}

export interface RaceJoinResult {
  ok: boolean;
  text: string;
}

/** Open a race lobby so everyone can inspect the horses before betting. */
export async function openRace(channel: SendableChannels): Promise<RaceJoinResult> {
  const existing = races.get(channel.id);
  if (existing) {
    return {
      ok: false,
      text:
        existing.phase === 'betting'
          ? 'Trường đua đang mở sẵn rồi, bấm nút trên bảng đua để đặt kèo!'
          : 'Ngựa đang chạy, chờ trận sau nhé!',
    };
  }

  const session: RaceSession = {
    channelId: channel.id,
    horses: generateHorses(),
    bets: new Map(),
    phase: 'betting',
    message: null,
    endsAt: Date.now() + BETTING_MS,
  };
  races.set(channel.id, session);
  try {
    session.message = await channel.send({
      embeds: [lobbyEmbed(session)],
      components: betButtons(session),
    });
  } catch (error) {
    races.delete(channel.id);
    console.error('[duangua] Failed to open lobby:', error);
    return { ok: false, text: 'Không mở được trường đua trong kênh này.' };
  }
  setTimeout(() => void runRace(channel.id), BETTING_MS);
  return { ok: true, text: '🏇 Trường đua đã mở! Xem phong độ và tỷ lệ ăn rồi vào kèo thôi.' };
}

/** Place a bet on an already-open lobby. */
export async function placeRaceBet(
  channelId: string,
  userId: string,
  username: string,
  amount: number,
  horseIdx: number,
): Promise<RaceJoinResult> {
  if (horseIdx < 0 || horseIdx >= HORSE_COUNT) {
    return { ok: false, text: `Chọn ngựa từ 1 đến ${HORSE_COUNT} thôi!` };
  }
  const session = races.get(channelId);
  if (!session || session.phase !== 'betting') {
    return {
      ok: false,
      text: 'Chưa có trường đua nào đang nhận kèo. Mở trận mới bằng `/duangua`!',
    };
  }
  if (session.bets.has(userId)) {
    return { ok: false, text: 'Bạn đã đặt kèo trận này rồi, chờ ngựa chạy thôi!' };
  }
  if (!economy.debit(userId, amount, 'bet', 'duangua')) {
    return {
      ok: false,
      text: `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(userId))}`,
    };
  }

  session.bets.set(userId, { userId, username, horse: horseIdx, amount });
  try {
    await session.message?.edit({ embeds: [lobbyEmbed(session)] });
  } catch {
    // Lobby refresh is cosmetic; the bet still stands.
  }
  const horse = session.horses[horseIdx];
  return {
    ok: true,
    text: `✅ Đã đặt **${formatCoins(amount)}** cho ${NUM_EMOJI[horseIdx]} **${horse.name}** (thắng ăn x${horse.odds})`,
  };
}

async function runRace(channelId: string): Promise<void> {
  const session = races.get(channelId);
  if (!session || !session.message) {
    races.delete(channelId);
    return;
  }
  session.phase = 'racing';

  if (session.bets.size === 0) {
    try {
      await session.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.push)
            .setTitle('🏇 Trận đua bị hủy')
            .setDescription('Không ai đặt cược nên ngựa lười chạy. Mở trận mới bằng `/duangua`!'),
        ],
        components: [],
      });
    } catch {
      // Nothing to clean up beyond the session itself.
    }
    races.delete(channelId);
    return;
  }

  try {
    // House-banked payouts, so a favoured punter's redo costs no other player.
    const favoured = [...session.bets.values()].find((b) => luck.get(b.userId) > 0);
    const winner = favoured
      ? luck.favor(
          favoured.userId,
          () => pickWinner(session.horses),
          (w) => w === favoured.horse,
        )
      : pickWinner(session.horses);
    const positions = Array<number>(HORSE_COUNT).fill(0);

    for (let frame = 1; frame <= FRAMES; frame++) {
      for (let i = 0; i < HORSE_COUNT; i++) {
        positions[i] += 1 + Math.floor(Math.random() * 3);
      }
      if (frame < FRAMES) {
        for (let i = 0; i < HORSE_COUNT; i++) {
          positions[i] = Math.min(positions[i], TRACK_LEN - 1);
        }
      } else {
        for (let i = 0; i < HORSE_COUNT; i++) {
          positions[i] = Math.min(positions[i], TRACK_LEN - 1);
        }
        positions[winner] = TRACK_LEN;
      }
      const finished = frame === FRAMES;
      await session.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.playing)
            .setTitle(finished ? '🏇 VỀ ĐÍCH!' : `🏇 Đang đua... vòng ${frame}/${FRAMES}`)
            .setDescription(renderTrack(positions, session.horses, finished ? winner : null)),
        ],
        components: betButtons(session, true),
      });
      await sleep(FRAME_MS);
    }

    // settle
    const horse = session.horses[winner];
    const lines: string[] = [];
    for (const bet of session.bets.values()) {
      const payout = bet.horse === winner ? Math.floor(bet.amount * horse.odds) : 0;
      economy.settleGame(bet.userId, bet.amount, payout, 'duangua');
      lines.push(
        payout > 0
          ? `🎉 <@${bet.userId}> +${formatCoins(payout - bet.amount)}`
          : `💸 <@${bet.userId}> -${formatCoins(bet.amount)}`,
      );
    }

    await session.message.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle(`🏆 ${NUM_EMOJI[winner]} ${horse.name} về nhất! (x${horse.odds})`)
          .setDescription(lines.slice(0, 20).join('\n') || 'Không có kèo nào.')
          .setFooter({ text: 'Mở trận mới bằng /duangua hoặc !dn' }),
      ],
      components: [],
    });
  } catch (error) {
    console.error('[duangua] Race failed:', error);
    // Refund everyone if the race crashed mid-way.
    for (const bet of session.bets.values()) {
      economy.credit(bet.userId, bet.amount, 'refund', 'duangua');
    }
  } finally {
    races.delete(channelId);
  }
}

export const duanguaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('duangua')
    .setDescription('Mở trường đua ngựa: xem phong độ 4 con rồi cả kênh đặt cược qua nút'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.channel;
    if (!channel || !channel.isSendable()) {
      await interaction.reply({
        content: 'Không dùng được lệnh này ở đây.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const result = await openRace(channel);
    await interaction.reply({ content: result.text, flags: MessageFlags.Ephemeral });
  },
};

export const duanguaComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [channelId, action, horseArg] = args;
    if (action !== 'bet') return;

    const session = races.get(channelId);
    if (!session || session.phase !== 'betting') {
      await interaction.reply({
        content: 'Trận này đã đóng cược rồi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (session.bets.has(interaction.user.id)) {
      await interaction.reply({
        content: 'Bạn đã đặt kèo trận này rồi!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // showModal must be the FIRST response; no awaits before it.
    const horse = session.horses[Number(horseArg)];
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(componentId('dn', channelId, 'amount', horseArg))
        .setTitle(`Cược cho ${horse.name} (ăn x${horse.odds})`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('soxu')
              .setLabel('Số xu (vd: 100, 1k, all, half)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(12),
          ),
        ),
    );
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    const [channelId, action, horseArg] = args;
    if (action !== 'amount') return;

    const session = races.get(channelId);
    if (!session || session.phase !== 'betting' || !session.message) {
      await interaction.reply({
        content: 'Trận này đã đóng cược rồi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const raw = interaction.fields.getTextInputValue('soxu').trim();
    const amount = parseBetToken(raw, economy.getBalance(interaction.user.id));
    if (amount === null || amount < 10) {
      await interaction.reply({
        content: 'Số xu không hợp lệ (tối thiểu 10). Ví dụ: `100`, `1k`, `all`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = await placeRaceBet(
      channelId,
      interaction.user.id,
      interaction.user.displayName,
      amount,
      Number(horseArg),
    );
    await interaction.reply({ content: result.text, flags: MessageFlags.Ephemeral });
  },
};

/** Refund every open race bet on shutdown. */
export function refundPendingRaces(): number {
  let refunded = 0;
  for (const session of races.values()) {
    for (const bet of session.bets.values()) {
      economy.credit(bet.userId, bet.amount, 'refund', 'duangua');
      refunded++;
    }
  }
  races.clear();
  return refunded;
}
