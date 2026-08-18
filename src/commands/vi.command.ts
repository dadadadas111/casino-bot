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
  type ModalSubmitInteraction,
} from 'discord.js';
import { buffs, cash, economy, figurines, topups } from '../context.js';
import { env } from '../config/env.js';
import { BUFFS } from '../services/buff.service.js';
import { XU_PER_VND } from '../services/cash.service.js';
import { MAX_TOPUP, MIN_TOPUP } from '../services/topup.service.js';
import { parseBetToken } from '../services/bet-parse.js';
import { historyTable } from '../embeds/history-table.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { announce } from '../interactions/announce.js';
import { refuseIfDown } from '../interactions/downtime.js';
import { formatVnd, topupEmbed } from '../embeds/topup.js';
import type { Command } from './types.js';

const HISTORY_ROWS = 10;

/**
 * One panel for every pocket the player owns: wallet, vault and top-up
 * balance. Replaces the old /sodu, /bank, /cash and /lichsu spread.
 */
function walletEmbed(userId: string, displayName: string, avatar: string): EmbedBuilder {
  const profile = economy.getProfile(userId);
  const net = profile.totalWon - profile.totalLost;
  const cashBalance = cash.get(userId);
  const spouse = economy.spouseOf(userId);
  const figurine = figurines.get(userId);
  const jailed = economy.jailedUntil(userId);
  const hospitalized = economy.hospitalizedUntil(userId);

  const status = [
    spouse
      ? `💍 Đã kết hôn với <@${spouse}>`
      : figurine?.married
        ? `💍 Đã kết hôn với **${figurine.emoji} ${figurine.name}**`
        : '🕊️ Độc thân vui tính',
    jailed ? `🚔 Đang ngồi tù, ra tù <t:${Math.floor(jailed.getTime() / 1000)}:R>` : null,
    hospitalized
      ? `🏥 Đang nằm viện, xuất viện <t:${Math.floor(hospitalized.getTime() / 1000)}:R>`
      : null,
    ...buffs
      .activeList(userId)
      .map(
        (b) =>
          `${BUFFS[b.buff]?.emoji ?? '✨'} ${BUFFS[b.buff]?.name ?? b.buff} còn hiệu lực đến <t:${Math.floor(b.expiresAt.getTime() / 1000)}:R>`,
      ),
  ].filter(Boolean);

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`👛 Ví của ${displayName}`)
    .setThumbnail(avatar)
    .setDescription(
      [
        `👛 **Ví:** ${formatCoins(profile.balance)}`,
        `-# Cược được, nhưng trộm cũng móc được.`,
        `🏦 **Két:** ${formatCoins(economy.getBank(userId))}`,
        `-# An toàn tuyệt đối, muốn cược phải rút ra.`,
        `💵 **Tiền nạp:** ${formatVnd(cashBalance)}`,
        `-# Đổi được sang xu, 1đ ăn ${XU_PER_VND} xu.`,
      ].join('\n'),
    )
    .addFields(
      { name: 'Hạng', value: `#${profile.rank}`, inline: true },
      { name: 'Số ván', value: `${profile.gamesPlayed}`, inline: true },
      {
        name: 'Lời/lỗ',
        value: net >= 0 ? `+${formatCoins(net)}` : `-${formatCoins(-net)}`,
        inline: true,
      },
      { name: 'Tình trạng', value: status.join('\n'), inline: false },
    );
}

function walletRows(userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const hasCash = cash.get(userId) > 0;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('vi', 'gui'))
        .setLabel('Gửi két')
        .setEmoji('🏦')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(componentId('vi', 'rut'))
        .setLabel('Rút két')
        .setEmoji('💸')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(economy.getBank(userId) <= 0),
      new ButtonBuilder()
        .setCustomId(componentId('vi', 'doixu'))
        .setLabel('Đổi ra xu')
        .setEmoji('💱')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasCash),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(componentId('vi', 'nap'))
        .setLabel('Nạp tiền')
        .setEmoji('💵')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(componentId('vi', 'lichsu', userId))
        .setLabel('Lịch sử')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** The panel is ephemeral, so only the person who opened it can press anything. */
export function walletPanel(
  userId: string,
  displayName: string,
  avatar: string,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  return {
    embeds: [walletEmbed(userId, displayName, avatar)],
    components: walletRows(userId),
  };
}

export function historyEmbed(userId: string, displayName: string): EmbedBuilder {
  const { entries, total } = economy.getHistory(userId, HISTORY_ROWS);
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📜 Lịch sử giao dịch của ${displayName}`)
    .setDescription(
      [
        `Số dư hiện tại: **${formatCoins(economy.getBalance(userId))}**`,
        historyTable(entries),
      ].join('\n'),
    )
    .setFooter({
      text:
        (total > entries.length
          ? `${entries.length} giao dịch gần nhất trong tổng ${total}`
          : `Toàn bộ ${total} giao dịch`) + ' · giờ VN',
    });
}

function amountModal(action: string, title: string, hint: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(componentId('vi', 'amount', action))
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('soluong')
          .setLabel('Số tiền')
          .setPlaceholder(hint)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(15),
      ),
    );
}

export const viCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('vi')
    .setDescription('Ví, két và tiền nạp của bạn, gộp chung một bảng'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      ...walletPanel(
        interaction.user.id,
        interaction.user.displayName,
        interaction.user.displayAvatarURL(),
      ),
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Familiar second door: /sodu without a target opens the same panel. */
export const soduCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sodu')
    .setDescription('Xem ví của bạn (hoặc số dư của người khác)')
    .addUserOption((o) =>
      o.setName('nguoi').setDescription('Xem số dư của người khác').setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('nguoi');
    if (!target || target.id === interaction.user.id) {
      await interaction.reply({
        ...walletPanel(
          interaction.user.id,
          interaction.user.displayName,
          interaction.user.displayAvatarURL(),
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: 'Bot không có ví đâu!', flags: MessageFlags.Ephemeral });
      return;
    }
    const profile = economy.getProfile(target.id);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle(`👛 Ví của ${target.displayName}`)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(
            [
              `👛 Ví: **${formatCoins(profile.balance)}**`,
              `🏦 Két: **${formatCoins(economy.getBank(target.id))}**`,
              `🏆 Hạng #${profile.rank} · ${profile.gamesPlayed} ván đã chơi`,
              '',
              `Xem hồ sơ đầy đủ bằng \`/hoso nguoi:${target.displayName}\``,
            ].join('\n'),
          ),
      ],
    });
  },
};

/** Modals opened from a button can edit that button's message in place. */
async function refreshPanel(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  const panel = walletPanel(
    interaction.user.id,
    interaction.user.displayName,
    interaction.user.displayAvatarURL(),
  );
  if (interaction.isModalSubmit()) {
    if (interaction.isFromMessage()) await interaction.update(panel);
    else await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update(panel);
}

export const walletComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const [action, targetId] = args;
    const userId = interaction.user.id;

    if (action === 'lichsu') {
      const id = targetId ?? userId;
      const name =
        id === userId
          ? interaction.user.displayName
          : ((await interaction.client.users.fetch(id).catch(() => null))?.displayName ??
            'người này');
      await interaction.reply({
        embeds: [historyEmbed(id, name)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'gui') {
      if (await refuseIfDown(interaction)) return;
      await interaction.showModal(
        amountModal('gui', 'Gửi xu vào két', `Ví đang có ${economy.getBalance(userId)} xu`),
      );
      return;
    }
    if (action === 'rut') {
      if (await refuseIfDown(interaction)) return;
      await interaction.showModal(
        amountModal('rut', 'Rút xu từ két', `Két đang có ${economy.getBank(userId)} xu`),
      );
      return;
    }
    if (action === 'doixu') {
      if (await refuseIfDown(interaction)) return;
      await interaction.showModal(
        amountModal(
          'doixu',
          'Đổi tiền nạp sang xu',
          `Đang có ${cash.get(userId)}đ, 1đ ăn ${XU_PER_VND} xu`,
        ),
      );
      return;
    }
    if (action === 'nap') {
      if (!env.SEPAY_ACCOUNT) {
        await interaction.reply({
          content: 'Tính năng nạp tiền chưa được cấu hình. Liên hệ chủ bot nhé!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.showModal(
        amountModal(
          'nap',
          'Nạp tiền qua chuyển khoản',
          `Từ ${MIN_TOPUP.toLocaleString('vi-VN')}đ đến ${MAX_TOPUP.toLocaleString('vi-VN')}đ`,
        ),
      );
    }
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'amount') return;
    const action = args[1];
    const userId = interaction.user.id;
    const raw = interaction.fields.getTextInputValue('soluong').trim();

    // Same forgiving parser the typed bet commands use: 1k, 2m, all, half.
    const pool =
      action === 'gui'
        ? economy.getBalance(userId)
        : action === 'rut'
          ? economy.getBank(userId)
          : cash.get(userId);
    const amount = parseBetToken(raw, pool);

    const complain = async (text: string): Promise<void> => {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    };

    if (amount === null || amount <= 0) {
      await complain('Số không hợp lệ. Nhập số thường, hoặc `1k`, `2m`, `all`, `half`.');
      return;
    }

    if (action === 'gui' || action === 'rut') {
      const ok =
        action === 'gui' ? economy.depositBank(userId, amount) : economy.withdrawBank(userId, amount);
      if (!ok) {
        await complain(
          action === 'gui'
            ? `Không đủ xu trong ví! Ví của bạn: ${formatCoins(economy.getBalance(userId))}`
            : `Không đủ xu trong két! Két của bạn: ${formatCoins(economy.getBank(userId))}`,
        );
        return;
      }
      await refreshPanel(interaction);
      return;
    }

    if (action === 'doixu') {
      if (!cash.spend(userId, amount, 'exchange_xu')) {
        await complain(
          `Không đủ tiền nạp! Bạn đang có ${formatVnd(cash.get(userId))}. Nạp thêm bằng nút 💵 Nạp tiền.`,
        );
        return;
      }
      const xu = amount * XU_PER_VND;
      economy.credit(userId, xu, 'exchange', `${amount}vnd`);
      await refreshPanel(interaction);
      await announce(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.gold)
            .setDescription(
              `💱 **${interaction.user.displayName}** đổi ${formatVnd(amount)} lấy **${formatCoins(xu)}**.`,
            ),
        ],
      });
      return;
    }

    if (action === 'nap') {
      if (amount < MIN_TOPUP || amount > MAX_TOPUP) {
        await complain(
          `Nạp từ ${MIN_TOPUP.toLocaleString('vi-VN')}đ đến ${MAX_TOPUP.toLocaleString('vi-VN')}đ thôi nhé.`,
        );
        return;
      }
      const request = topups.createRequest(
        userId,
        amount,
        interaction.inGuild() ? interaction.guildId : null,
        interaction.channelId,
      );
      await interaction.reply({
        embeds: [topupEmbed(amount, request.code)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
