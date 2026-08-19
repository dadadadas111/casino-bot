import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { assets, buffs, economy, figurines, loans, profiles } from '../context.js';
import { KIND_LABEL } from '../services/assets.service.js';
import { amountDue } from '../services/loan.service.js';
import { rankFor, shiftsToNext } from '../services/job.service.js';
import { BUFFS } from '../services/buff.service.js';
import { GAME_LABELS } from '../embeds/history-table.js';
import { SHOP_ITEMS } from '../services/items.service.js';
import { formatVnd } from '../embeds/topup.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId } from '../interactions/ids.js';
import { currentDowntime, releaseRow } from '../interactions/downtime.js';
import type { Command } from './types.js';

const unix = (iso: string): number => Math.floor(Date.parse(iso.replace(' ', 'T') + 'Z') / 1000);

export const hosoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hoso')
    .setDescription('Hồ sơ đầy đủ: tài sản, thành tích từng trò, tiền án tiền sự, gia đình')
    .addUserOption((o) => o.setName('nguoi').setDescription('Xem hồ sơ của ai').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi') ?? interaction.user;
    if (target.bot) {
      await interaction.reply({
        content: 'Bot làm gì có hồ sơ!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const p = profiles.get(target.id, interaction.inGuild() ? interaction.guildId : null);
    const net = p.totalWon - p.totalLost;
    const jailed = economy.jailedUntil(target.id);
    const hospitalized = economy.hospitalizedUntil(target.id);
    const activeBuffs = buffs.activeList(target.id);

    const loan = loans.open(target.id);
    const status = [
      loan
        ? `${loan.dueAt.getTime() < Date.now() ? '🔥' : '💰'} Đang nợ **${formatCoins(amountDue(loan.principal, loan.dueAt, new Date()))}**, hạn <t:${Math.floor(loan.dueAt.getTime() / 1000)}:R>${loan.dunned > 0 ? ` · bị đòi ${loan.dunned} lần` : ''}`
        : null,
      jailed ? `🚔 Đang ngồi tù, ra <t:${Math.floor(jailed.getTime() / 1000)}:R>` : null,
      hospitalized
        ? `🏥 Đang nằm viện, ra <t:${Math.floor(hospitalized.getTime() / 1000)}:R>`
        : null,
      ...activeBuffs.map(
        (b) =>
          `${BUFFS[b.buff]?.emoji ?? '✨'} ${BUFFS[b.buff]?.name ?? b.buff} đến <t:${Math.floor(b.expiresAt.getTime() / 1000)}:R>`,
      ),
    ].filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(COLORS.gold)
      .setTitle(`📋 Hồ sơ của ${target.displayName}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        [
          `🏅 Hạng **#${p.rank}** · 🎮 **${p.gamesPlayed}** ván · 📅 Vào sòng <t:${unix(p.joinedAt)}:R>`,
          ...(status.length > 0 ? ['', ...status] : []),
        ].join('\n'),
      )
      .addFields(
        {
          name: '💰 Tài sản',
          value: [
            `👛 Ví: **${formatCoins(p.balance)}**`,
            `🏦 Két: **${formatCoins(p.bank)}**`,
            `💵 Tiền nạp: **${formatVnd(p.cash)}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💼 Nghề nghiệp',
          value: (() => {
            const shifts = economy.workShifts(target.id);
            const rank = rankFor(shifts);
            const toNext = shiftsToNext(shifts);
            return [
              `${rank.emoji} **${rank.name}** · ${shifts} ca`,
              toNext > 0 ? `-# Còn ${toNext} ca nữa lên chức` : '-# Đỉnh cao sự nghiệp 🏆',
            ].join('\n');
          })(),
          inline: true,
        },
        {
          name: '📊 Thành tích',
          value: [
            `Thắng: ${formatCoins(p.totalWon)}`,
            `Thua: ${formatCoins(p.totalLost)}`,
            `Lời/lỗ: **${net >= 0 ? '+' : '-'}${formatCoins(Math.abs(net))}**`,
            `🔥 Điểm danh: ${p.dailyStreak} ngày`,
          ].join('\n'),
          inline: true,
        },
      );

    // Only the favourite game: the full per-game list made the card a wall.
    const favorite = p.games.find((g) => g.bets > 0);
    if (favorite) {
      const label = GAME_LABELS[favorite.game] ?? favorite.game;
      const gameNet = favorite.won - favorite.staked;
      embed.addFields({
        name: '🎲 Trò tủ',
        value: [
          `**${label}** · ${favorite.bets} lượt · cược ${formatCoins(favorite.staked)}`,
          `Lời/lỗ riêng trò này: **${gameNet >= 0 ? '+' : '-'}${formatCoins(Math.abs(gameNet))}**${favorite.biggestWin > 0 ? ` · đậm nhất +${formatCoins(favorite.biggestWin)}` : ''}`,
        ].join('\n'),
      });
    }

    embed.addFields({
      name: '🚨 Tiền án tiền sự',
      value: [
        `🚔 Đi tù: **${p.jailTotal}** lần · 🏥 Nhập viện: **${p.hospitalTotal}** lần`,
        `🦹 Trộm thành công: **${p.robsWon}** lần (cuỗm ${formatCoins(p.robLoot)}) · 😱 Bị trộm: **${p.robsSuffered}** lần`,
        `🎫 Đã mua **${p.lotteryTickets}** vé số${p.weddingGifts > 0 ? ` · 🎁 Nhận ${formatCoins(p.weddingGifts)} tiền mừng cưới` : ''}`,
      ].join('\n'),
    });

    embed.addFields({
      name: '💍 Gia đình',
      value: (() => {
        if (p.spouse) {
          return `Đã kết hôn với <@${p.spouse}>${p.marriedAt ? ` từ <t:${unix(p.marriedAt)}:D> (<t:${unix(p.marriedAt)}:R>)` : ''}`;
        }
        const fig = figurines.get(target.id);
        if (fig?.married) return `Đã kết hôn với **${fig.emoji} ${fig.name}** (hình nộm)`;
        if (fig) return `Đang có bạn tưởng tượng **${fig.emoji} ${fig.name}**, chưa cưới`;
        return 'Độc thân vui tính 🕊️';
      })(),
    });

    const owned = assets.owned(target.id);
    if (owned.length > 0) {
      embed.addFields({
        name: '🏠 Tài sản',
        value: owned
          .map((a) => `${a.emoji} **${a.name}** (${KIND_LABEL[a.kind].name})`)
          .join('\n'),
        inline: false,
      });
    }

    const debtHistory = loans.history(target.id);
    if (debtHistory.taken > 0) {
      embed.addFields({
        name: '🧾 Lịch sử vay',
        value:
          `Đã vay **${debtHistory.taken}** lần` +
          (debtHistory.defaulted > 0
            ? ` · **quỵt ${debtHistory.defaulted}** lần 😬`
            : ' · chưa quỵt lần nào ✅'),
        inline: false,
      });
    }

    if (p.items.length > 0) {
      embed.addFields({
        name: '🎒 Túi đồ',
        value: p.items
          .map((i) => `${SHOP_ITEMS[i.item]?.emoji ?? '❔'} ${SHOP_ITEMS[i.item]?.name ?? i.item} x${i.qty}`)
          .join(' · '),
      });
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(componentId('vi', 'lichsu', target.id))
          .setLabel('Lịch sử giao dịch')
          .setEmoji('📜')
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
    // Buying your way out only makes sense on your own card.
    const downtime = target.id === interaction.user.id ? currentDowntime(target.id) : null;
    if (downtime) rows.push(releaseRow(downtime.kind, downtime.fee));

    await interaction.reply({
      embeds: [embed],
      components: rows,
      allowedMentions: { parse: [] },
    });
  },
};
