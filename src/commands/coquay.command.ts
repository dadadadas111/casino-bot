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
  type SendableChannels,
} from 'discord.js';
import { economy, items } from '../context.js';
import { HOSPITAL_DURATION_MS, MEDICAL_BASE_FEE } from '../services/economy.service.js';
import {
  CHAMBERS,
  MIN_PLAYERS,
  simulateRound,
  survivorShare,
} from '../services/roulette.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import type { Command } from './types.js';

const JOIN_MS = 45_000;
const PULL_DELAY_MS = 2_000;

interface Player {
  id: string;
  name: string;
}

interface Table {
  channelId: string;
  hostId: string;
  bet: number;
  players: Player[];
  phase: 'joining' | 'playing';
  message: Message | null;
  endsAt: number;
}

const tables = new Map<string, Table>();

function lobbyEmbed(t: Table): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle('🔫 Cò quay Nga: bàn đang mở')
    .setDescription(
      [
        `Cược **${formatCoins(t.bet)}** mỗi người. Ổ đạn ${CHAMBERS} viên, đúng **1 viên thật**.`,
        'Thay phiên bóp cò, ai dính đạn thì mất cược và nằm viện. Người sống chia tiền của nạn nhân.',
        '',
        `Bắt đầu <t:${Math.floor(t.endsAt / 1000)}:R>, cần ít nhất ${MIN_PLAYERS} người.`,
      ].join('\n'),
    )
    .addFields({
      name: `👥 Con bạc liều mạng (${t.players.length})`,
      value: t.players.map((p) => `• ${p.name}`).join('\n'),
    })
    .setFooter({ text: 'Chủ bàn bấm Bắt đầu để chơi sớm' });
}

function lobbyButtons(t: Table): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('cq', t.channelId, 'join'))
        .setLabel(`Tham gia (${t.bet.toLocaleString('vi-VN')} xu)`)
        .setEmoji('🔫')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(componentId('cq', t.channelId, 'start'))
        .setLabel('Bắt đầu')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(componentId('cq', t.channelId, 'leave'))
        .setLabel('Rút lui')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function closeTable(channelId: string): void {
  tables.delete(channelId);
}

/** Refund every ante and drop the table. */
async function abortTable(t: Table, reason: string): Promise<void> {
  closeTable(t.channelId);
  for (const p of t.players) {
    economy.credit(p.id, t.bet, 'refund', 'coquay');
  }
  try {
    await t.message?.edit({
      embeds: [
        new EmbedBuilder().setColor(COLORS.push).setTitle('🔫 Bàn đã dẹp').setDescription(reason),
      ],
      components: [],
    });
  } catch (error) {
    console.error('[coquay] Failed to close table:', error);
  }
}

async function runGame(channelId: string): Promise<void> {
  const t = tables.get(channelId);
  if (!t || t.phase === 'playing' || !t.message) return;

  if (t.players.length < MIN_PLAYERS) {
    await abortTable(t, `Không đủ ${MIN_PLAYERS} người chơi, tiền cược đã hoàn lại.`);
    return;
  }
  t.phase = 'playing';

  try {
    const round = simulateRound(t.players.length);
    const lines: string[] = [];

    for (let i = 0; i < round.pulls.length; i++) {
      const pull = round.pulls[i];
      const player = t.players[pull.player];
      lines.push(
        pull.died
          ? `💥 **${player.name}** bóp cò... **ĐOÀNG!** Dính đạn rồi!`
          : `🔘 **${player.name}** bóp cò... *cạch*, ổ rỗng. Thở phào.`,
      );
      await t.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(pull.died ? COLORS.lose : COLORS.playing)
            .setTitle('🔫 Cò quay Nga đang diễn ra')
            .setDescription(lines.join('\n'))
            .setFooter({
              text: pull.died
                ? 'Ván đấu kết thúc'
                : `Còn ${CHAMBERS - i - 1} ổ, xác suất dính đạn ngày càng cao...`,
            }),
        ],
        components: [],
      });
      if (!pull.died) await sleep(PULL_DELAY_MS);
    }

    const victim = t.players[round.victimIndex];
    const survivors = t.players.filter((p) => p.id !== victim.id);
    const share = survivorShare(t.bet, survivors.length);

    economy.settleGame(victim.id, t.bet, 0, 'coquay');
    // A helmet eats the trip to hospital, but not the lost ante.
    const helmeted = items.consume(victim.id, 'mubaohiem');
    const release = helmeted ? null : economy.hospitalize(victim.id, HOSPITAL_DURATION_MS);
    for (const s of survivors) {
      economy.settleGame(s.id, t.bet, t.bet + share, 'coquay');
    }

    await t.message.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🔫 Cò quay Nga: kết thúc')
          .setDescription(
            [
              ...lines,
              '',
              release
                ? `🏥 **${victim.name}** trúng đạn, mất ${formatCoins(t.bet)} và nhập viện, ra viện <t:${Math.floor(release.getTime() / 1000)}:R>.`
                : `🪖 **${victim.name}** trúng đạn, mất ${formatCoins(t.bet)} nhưng **mũ bảo hiểm** đỡ trọn phát! Chỉ xây xẩm mặt mày, khỏi nhập viện. Mũ vỡ tan.`,
              `🎉 Người sống sót nhận thêm **${formatCoins(share)}** mỗi người: ${survivors.map((s) => s.name).join(', ')}`,
              '',
              release
                ? `-# Nằm viện thì cấm chơi bời. Trả viện phí ${formatCoins(economy.releaseFee(victim.id, 'hospital'))} trong \`/hoso\` để ra sớm.`
                : '-# Mua mũ mới trong `/shop` trước khi cầm súng lần nữa nhé.',
            ].join('\n'),
          ),
      ],
      components: [],
    });
  } catch (error) {
    console.error('[coquay] Game failed:', error);
    for (const p of t.players) economy.credit(p.id, t.bet, 'refund', 'coquay');
  } finally {
    closeTable(channelId);
  }
}

export const coquayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('coquay')
    .setDescription('Cò quay Nga nhiều người: ai dính đạn thì nằm viện, người sống chia tiền')
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu mỗi người cược').setRequired(true).setMinValue(100),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.channel;
    if (!channel?.isSendable() || !interaction.inGuild()) {
      await interaction.reply({
        content: 'Không dùng được lệnh này ở đây.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (tables.has(channel.id)) {
      await interaction.reply({
        content: 'Kênh này đang có một bàn cò quay rồi, vào bàn đó đi!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const bet = interaction.options.getInteger('cuoc', true);
    if (!economy.debit(interaction.user.id, bet, 'bet', 'coquay')) {
      await interaction.reply({
        content: `Không đủ xu! Ví của bạn: ${formatCoins(economy.getBalance(interaction.user.id))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const table: Table = {
      channelId: channel.id,
      hostId: interaction.user.id,
      bet,
      players: [{ id: interaction.user.id, name: interaction.user.displayName }],
      phase: 'joining',
      message: null,
      endsAt: Date.now() + JOIN_MS,
    };
    tables.set(channel.id, table);

    await interaction.reply({ embeds: [lobbyEmbed(table)], components: lobbyButtons(table) });
    table.message = await interaction.fetchReply();
    setTimeout(() => void runGame(channel.id), JOIN_MS);
  },
};

export const coquayComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [channelId, action] = args;
    const table = tables.get(channelId);

    if (!table || table.phase !== 'joining') {
      await interaction.reply({
        content: 'Bàn này đã bắt đầu hoặc đã dẹp rồi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const userId = interaction.user.id;
    const seated = table.players.some((p) => p.id === userId);

    if (action === 'start') {
      if (userId !== table.hostId) {
        await interaction.reply({
          content: 'Chỉ chủ bàn mới bắt đầu được.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (table.players.length < MIN_PLAYERS) {
        await interaction.reply({
          content: `Cần ít nhất ${MIN_PLAYERS} người mới chơi được, rủ thêm đi!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferUpdate();
      await runGame(channelId);
      return;
    }

    if (action === 'leave') {
      if (!seated) {
        await interaction.reply({
          content: 'Bạn có ngồi bàn đâu mà rút.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (userId === table.hostId) {
        await interaction.deferUpdate();
        await abortTable(table, 'Chủ bàn rút lui, bàn dẹp và tiền cược đã hoàn lại.');
        return;
      }
      table.players = table.players.filter((p) => p.id !== userId);
      economy.credit(userId, table.bet, 'refund', 'coquay');
      await interaction.update({ embeds: [lobbyEmbed(table)], components: lobbyButtons(table) });
      return;
    }

    // join
    if (seated) {
      await interaction.reply({
        content: 'Bạn đã ngồi vào bàn rồi!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (economy.hospitalizedUntil(userId)) {
      await interaction.reply({
        content: 'Đang nằm viện mà còn đòi cầm súng à!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!economy.debit(userId, table.bet, 'bet', 'coquay')) {
      await interaction.reply({
        content: `Không đủ ${formatCoins(table.bet)} để vào bàn.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    table.players.push({ id: userId, name: interaction.user.displayName });
    await interaction.update({ embeds: [lobbyEmbed(table)], components: lobbyButtons(table) });
  },
};

/** Refund every seated ante on shutdown. */
export function refundPendingRoulette(): number {
  let refunded = 0;
  for (const table of tables.values()) {
    for (const player of table.players) {
      economy.credit(player.id, table.bet, 'refund', 'coquay');
      refunded++;
    }
  }
  tables.clear();
  return refunded;
}
