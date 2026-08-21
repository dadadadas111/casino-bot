import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { assets, cash, economy, items, loans, lottery } from '../context.js';
import { recommend, type AdvisorState } from '../services/advisor.service.js';
import { amountDue } from '../services/loan.service.js';
import { CHUTICH_FLOOR } from '../services/boardroom.service.js';
import { COLORS } from '../embeds/format.js';
import type { Command } from './types.js';

const HOUR_MS = 60 * 60 * 1000;

/** Read everything the advisor needs about one player. */
function snapshot(userId: string, now = new Date()): AdvisorState {
  const jailed = economy.jailedUntil(userId, now);
  const hospitalized = economy.hospitalizedUntil(userId, now);
  const loan = loans.open(userId);
  const owed = loan ? amountDue(loan.principal, loan.dueAt, now) : 0;
  const overdue = loan ? loan.dueAt.getTime() < now.getTime() : false;

  return {
    jailed: jailed !== null,
    jailFee: economy.releaseFee(userId, 'jail', now),
    hospitalized: hospitalized !== null,
    hospitalFee: economy.releaseFee(userId, 'hospital', now),
    hasKey: items.count(userId, 'chiakhoa') > 0,
    loanOverdue: overdue,
    loanDueSoonHours:
      loan && !overdue ? Math.max(0, Math.round((loan.dueAt.getTime() - now.getTime()) / HOUR_MS)) : null,
    loanOwed: owed,
    canDaily: economy.canClaimDaily(userId, now),
    workReady: economy.workReadyAt(userId, now).getTime() <= now.getTime(),
    isChutich: economy.workShifts(userId) >= CHUTICH_FLOOR,
    quizReady: economy.canPlayQuiz(userId, now),
    wallet: economy.getBalance(userId),
    bank: economy.getBank(userId),
    cash: cash.get(userId),
    jackpot: lottery.getJackpot(),
  };
}

export const recommendCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('Gợi ý nên làm gì tiếp theo, dựa trên tình trạng hiện tại của bạn')
    .addUserOption((o) =>
      o.setName('nguoi').setDescription('Xem gợi ý cho người khác').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi') ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: 'Bot thì cần gợi ý gì!', flags: MessageFlags.Ephemeral });
      return;
    }
    const self = target.id === interaction.user.id;
    const advice = recommend(snapshot(target.id));

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`🧭 Gợi ý cho ${target.displayName}`)
      .setDescription(
        advice
          .map((a, i) => `${i === 0 ? '**' : ''}${a.icon} ${a.title}${i === 0 ? '**' : ''}\n-# ${a.detail}`)
          .join('\n\n'),
      )
      .setFooter({
        text: self
          ? 'Xếp theo mức cần kíp, việc trên cùng nên làm trước.'
          : `Nhìn hộ ${target.displayName} xem nên làm gì.`,
      });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
