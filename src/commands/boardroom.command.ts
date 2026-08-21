import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { economy } from '../context.js';
import {
  BOARD_CHANCE,
  CHUTICH_FLOOR,
  type Scenario,
  SCENARIOS,
  type BoardOption,
  demoteFloor,
  demotionChance,
  rollOutcome,
} from '../services/boardroom.service.js';
import { rankFor } from '../services/job.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { announce } from '../interactions/announce.js';
import { COLORS, formatCoins } from '../embeds/format.js';

/**
 * A pending boardroom decision: the shift's cooldown is already spent and its
 * work counted, but the wage waits on the player's choice. Held in memory and
 * refunded on shutdown, like the game stakes.
 */
interface Pending {
  userId: string;
  username: string;
  gross: number;
  scenario: Scenario;
  timeout: NodeJS.Timeout;
}

const pending = new Map<string, Pending>();
const DECIDE_MS = 3 * 60 * 1000;

/** True when this shift should open the boardroom rather than pay out. */
export function isBoardShift(workCount: number, roll: number = Math.random()): boolean {
  return workCount >= CHUTICH_FLOOR && roll < BOARD_CHANCE;
}

function pickScenario(): Scenario {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

function decisionEmbed(username: string, gross: number, scenario: Scenario): EmbedBuilder {
  const kindLabel =
    scenario.kind === 'clear' ? 'Quyết định điều hành' : scenario.kind === 'luck' ? 'Canh bạc' : '⚠️ Quyết định mạo hiểm';
  return new EmbedBuilder()
    .setColor(scenario.kind === 'risk' ? COLORS.lose : COLORS.playing)
    .setTitle('🏦 Phòng họp Chủ tịch')
    .setDescription(
      [
        `**${username}**, một quyết định đang chờ bạn:`,
        '',
        `*${scenario.situation}*`,
        '',
        `-# Lương cơ bản ca này: ${formatCoins(gross)}. Lựa chọn của bạn quyết định nó nhân lên hay mất trắng.`,
      ].join('\n'),
    );
}

function decisionButtons(userId: string, scenario: Scenario): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      scenario.options.map((option, i) => {
        const risk = demotionChance(option);
        const label =
          option.risky && risk > 0
            ? `${option.label} (${Math.round(risk * 100)}% phá sản)`
            : option.label;
        return new ButtonBuilder()
          .setCustomId(componentId('board', userId, String(i)))
          .setLabel(label.slice(0, 80))
          .setStyle(option.risky ? ButtonStyle.Danger : ButtonStyle.Primary);
      }),
    ),
  ];
}

/**
 * Open a boardroom decision for a shift already begun (cooldown spent). The
 * caller posts the returned payload; the choice is handled by the component.
 */
export function openDecision(
  userId: string,
  username: string,
  gross: number,
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const scenario = pickScenario();
  const timeout = setTimeout(() => void resolveTimeout(userId), DECIDE_MS);
  pending.set(userId, { userId, username, gross, scenario, timeout });
  return { embeds: [decisionEmbed(username, gross, scenario)], components: decisionButtons(userId, scenario) };
}

/** An abandoned decision pays the plain shift, so nobody loses a shift to AFK. */
async function resolveTimeout(userId: string): Promise<void> {
  const p = pending.get(userId);
  if (!p) return;
  pending.delete(userId);
  economy.settleBoardWage(userId, p.gross);
}

async function applyOutcome(
  interaction: ButtonInteraction,
  p: Pending,
  option: BoardOption,
): Promise<void> {
  const outcome = rollOutcome(option.outcomes);

  if (outcome.effect.kind === 'demote') {
    // The chosen risk came due: pay nothing and knock the title down.
    const toRank = rankFor(demoteFloor(outcome.effect.toRank));
    economy.demote(p.userId, demoteFloor(outcome.effect.toRank));
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.lose)
          .setTitle('💥 PHÁ SẢN')
          .setDescription(
            [
              `**${p.username}** chọn **${option.label}**.`,
              '',
              outcome.text,
              '',
              `📉 Mất chức Chủ tịch, rơi xuống ${toRank.emoji} **${toRank.name}**. Cày lại thôi.`,
            ].join('\n'),
          ),
      ],
      components: [],
    });
    await announce(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.lose)
          .setDescription(
            `📉 Chấn động thương trường: <@${p.userId}> vừa phá sản và mất ghế Chủ tịch, rơi xuống ${toRank.emoji} **${toRank.name}**!`,
          ),
      ],
      allowedMentions: { users: [p.userId] },
    });
    return;
  }

  const wage = Math.round(p.gross * outcome.effect.mult);
  const { net, tax } = economy.settleBoardWage(p.userId, wage);
  const win = outcome.effect.mult >= 1;
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(outcome.effect.mult >= 2 ? COLORS.gold : win ? COLORS.win : COLORS.push)
        .setTitle(outcome.effect.mult >= 2 ? '📈 Quyết định để đời!' : win ? '📊 Ổn' : '📉 Lỗ')
        .setDescription(
          [
            `**${p.username}** chọn **${option.label}**.`,
            '',
            outcome.text,
            '',
            `Lương ca này: **${formatCoins(net)}**${tax > 0 ? ` (đã trừ ${formatCoins(tax)} thuế)` : ''}`,
            `Số dư mới: ${formatCoins(economy.getBalance(p.userId))}`,
          ].join('\n'),
        )
        .setFooter({ text: `Lương gốc ${p.gross.toLocaleString('vi-VN')} × ${outcome.effect.mult}` }),
    ],
    components: [],
  });
}

export const boardComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [ownerId, indexRaw] = args;
    const p = pending.get(ownerId);
    if (!p) {
      await interaction.reply({ content: 'Quyết định này đã xong rồi.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Ghế Chủ tịch của người ta, quyết hộ làm gì!', flags: MessageFlags.Ephemeral });
      return;
    }
    const option = p.scenario.options[Number(indexRaw)];
    if (!option) return;
    clearTimeout(p.timeout);
    pending.delete(ownerId);
    await applyOutcome(interaction, p, option);
  },
};

/** Pay out any undecided shift on shutdown so nobody loses a spent shift. */
export function refundPendingBoard(): number {
  let refunded = 0;
  for (const p of pending.values()) {
    clearTimeout(p.timeout);
    economy.settleBoardWage(p.userId, p.gross);
    refunded++;
  }
  pending.clear();
  return refunded;
}

