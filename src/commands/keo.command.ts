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
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins, sleep } from '../embeds/format.js';
import type { Command } from './types.js';

const CHALLENGE_TIMEOUT_MS = 120_000;

interface DuelSession {
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  bet: number;
  message: Message | null;
  timeout: NodeJS.Timeout;
}

// Keyed by the originating interaction id (carried in the button customId).
const duels = new Map<string, DuelSession>();

function challengeEmbed(s: DuelSession): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle('⚔️ Kèo tung đồng xu 1v1')
    .setDescription(
      [
        `**${s.challengerName}** thách đấu **${s.targetName}**!`,
        `Mỗi người cược **${formatCoins(s.bet)}**, ai thắng ăn cả **${formatCoins(s.bet * 2)}**.`,
        '',
        `<@${s.targetId}> bấm nút để nhận hoặc từ chối. Kèo tự hủy sau 2 phút.`,
      ].join('\n'),
    );
}

function closedEmbed(s: DuelSession, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.push)
    .setTitle('⚔️ Kèo tung đồng xu: Đã đóng')
    .setDescription(`${reason}\nTiền cược của **${s.challengerName}** đã được hoàn lại.`);
}

function buttons(duelId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('keo', duelId, 'accept'))
        .setLabel('Nhận kèo')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(componentId('keo', duelId, 'decline'))
        .setLabel('Từ chối')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(componentId('keo', duelId, 'cancel'))
        .setLabel('Hủy kèo')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

/** Remove the session and refund the challenger's escrowed bet. */
function refundAndClose(duelId: string, session: DuelSession): void {
  clearTimeout(session.timeout);
  duels.delete(duelId);
  economy.credit(session.challengerId, session.bet, 'refund', 'keo');
}

async function expire(duelId: string): Promise<void> {
  const session = duels.get(duelId);
  if (!session) return;
  refundAndClose(duelId, session);
  try {
    await session.message?.edit({
      embeds: [closedEmbed(session, 'Hết hạn, không ai nhận kèo.')],
      components: [],
    });
  } catch (error) {
    console.error('[keo] Failed to edit message on expiry:', error);
  }
}

export const keoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('keo')
    .setDescription('Thách 1 người solo tung đồng xu: mỗi bên cược bằng nhau, ai thắng ăn cả')
    .addUserOption((o) => o.setName('nguoi').setDescription('Người bị thách đấu').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('cuoc').setDescription('Số xu mỗi bên cược').setRequired(true).setMinValue(10),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi', true);
    const bet = interaction.options.getInteger('cuoc', true);

    if (target.bot) {
      await interaction.reply({
        content: 'Bot không chơi kèo đâu, tìm người thật mà thách!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({
        content: 'Không thể tự thách đấu chính mình.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!economy.debit(interaction.user.id, bet, 'bet', 'keo')) {
      await interaction.reply({
        content: `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(interaction.user.id))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const duelId = interaction.id;
    const session: DuelSession = {
      challengerId: interaction.user.id,
      challengerName: interaction.user.displayName,
      targetId: target.id,
      targetName: target.displayName,
      bet,
      message: null,
      timeout: setTimeout(() => void expire(duelId), CHALLENGE_TIMEOUT_MS),
    };
    duels.set(duelId, session);

    await interaction.reply({
      content: `<@${target.id}>`,
      embeds: [challengeEmbed(session)],
      components: buttons(duelId),
      allowedMentions: { users: [target.id] },
    });
    session.message = await interaction.fetchReply();
  },
};

export const keoComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [duelId, action] = args;
    const session = duels.get(duelId);
    if (!session) {
      await interaction.reply({
        content: 'Kèo này đã đóng hoặc hết hạn.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'cancel') {
      if (interaction.user.id !== session.challengerId) {
        await interaction.reply({
          content: 'Chỉ người mở kèo mới hủy được.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      refundAndClose(duelId, session);
      await interaction.update({
        embeds: [closedEmbed(session, `**${session.challengerName}** đã hủy kèo.`)],
        components: [],
      });
      return;
    }

    if (interaction.user.id !== session.targetId) {
      await interaction.reply({
        content: 'Kèo này không dành cho bạn. Mở kèo riêng bằng `/keo` nhé!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'decline') {
      refundAndClose(duelId, session);
      await interaction.update({
        embeds: [closedEmbed(session, `**${session.targetName}** đã từ chối kèo.`)],
        components: [],
      });
      return;
    }

    // accept
    if (!economy.debit(session.targetId, session.bet, 'bet', 'keo')) {
      await interaction.reply({
        content: `Không đủ xu để nhận kèo! Số dư của bạn: ${formatCoins(economy.getBalance(session.targetId))}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    clearTimeout(session.timeout);
    duels.delete(duelId);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.playing)
          .setTitle('⚔️ Kèo tung đồng xu 1v1')
          .setDescription(
            `**${session.targetName}** đã nhận kèo!\n\n🪙 Đồng xu đang xoay...`,
          ),
      ],
      components: [],
    });
    await sleep(1500);

    const challengerWins = Math.random() < 0.5;
    const winnerId = challengerWins ? session.challengerId : session.targetId;
    const loserId = challengerWins ? session.targetId : session.challengerId;
    const winnerName = challengerWins ? session.challengerName : session.targetName;
    const loserName = challengerWins ? session.targetName : session.challengerName;
    economy.settleGame(winnerId, session.bet, session.bet * 2, 'keo');
    economy.settleGame(loserId, session.bet, 0, 'keo');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('⚔️ Kèo tung đồng xu: Kết quả')
          .setDescription(
            [
              `🏆 **${winnerName}** thắng, ăn trọn **${formatCoins(session.bet * 2)}**!`,
              `💸 **${loserName}** mất ${formatCoins(session.bet)}.`,
            ].join('\n'),
          ),
      ],
    });
  },
};
