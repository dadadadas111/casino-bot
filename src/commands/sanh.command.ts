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
import { assets, economy, lottery } from '../context.js';
import { BAU_CUA_SYMBOLS, type BauCuaSymbol } from '../services/minigames.service.js';
import { parseBetToken } from '../services/bet-parse.js';
import { rankFor, shiftsToNext } from '../services/job.service.js';
import { TICKET_PRICE } from '../services/lottery.service.js';
import { componentId, type ComponentHandler } from '../interactions/ids.js';
import { COLORS, formatCoins } from '../embeds/format.js';
import { refuseIfDown } from '../interactions/downtime.js';
import { runBlackjack } from './blackjack.command.js';
import { runTaiXiu } from './taixiu.command.js';
import { runBauCua } from './baucua.command.js';
import { runSlots } from './slots.command.js';
import { runHiLo } from './hilo.command.js';
import { runDoMin } from './domin.command.js';
import { runCoQuay } from './coquay.command.js';
import { runTrieuPhu } from './trieuphu.command.js';
import { openRace } from './duangua.command.js';
import { walletPanel } from './vi.command.js';
import { bagPanel } from './tuido.command.js';
import { helpPanel } from './help.command.js';
import type { Command } from './types.js';

/**
 * A pinnable lobby. In a server with thirty other apps the slash picker is a
 * wall of strangers' commands, so the whole casino gets one message full of
 * buttons instead. Every button here is stateless: the pinned message keeps
 * working after a restart, forever.
 */

interface BetGame {
  key: string;
  label: string;
  emoji: string;
  title: string;
  /** A second modal field, for games that also need a pick. */
  pick?: { label: string; placeholder: string };
}

const BET_GAMES: BetGame[] = [
  { key: 'bj', label: 'Blackjack', emoji: '🃏', title: 'Blackjack' },
  {
    key: 'tx',
    label: 'Tài xỉu',
    emoji: '🎲',
    title: 'Tài xỉu',
    pick: { label: 'Cửa: tài hay xỉu', placeholder: 'tai / xiu' },
  },
  { key: 'sl', label: 'Máy xèng', emoji: '🎰', title: 'Máy xèng' },
  { key: 'hl', label: 'Cao hay Thấp', emoji: '🎴', title: 'Cao hay Thấp' },
  { key: 'dm', label: 'Dò mìn', emoji: '💣', title: 'Dò mìn' },
  {
    key: 'bc',
    label: 'Bầu cua',
    emoji: '🦀',
    title: 'Bầu cua tôm cá',
    pick: { label: 'Cửa: bầu, cua, tôm, cá, gà, nai', placeholder: 'ga' },
  },
  { key: 'cq', label: 'Cò quay Nga', emoji: '🔫', title: 'Cò quay Nga' },
];

const TAIXIU_PICKS: Record<string, 'tai' | 'xiu'> = {
  tai: 'tai', tài: 'tai', t: 'tai', x: 'xiu', xiu: 'xiu', xỉu: 'xiu',
};
const BAUCUA_PICKS: Record<string, BauCuaSymbol> = {
  bau: 'bau', bầu: 'bau', b: 'bau', cua: 'cua', c: 'cua', tom: 'tom', tôm: 'tom',
  ca: 'ca', cá: 'ca', ga: 'ga', gà: 'ga', g: 'ga', nai: 'nai', n: 'nai',
};

function lobbyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('🎰 Sảnh sòng bạc')
    .setDescription(
      [
        'Bấm nút là chơi, khỏi phải lục trong đống lệnh gạch chéo của cả server.',
        '',
        `🎱 Hũ xổ số đang có **${formatCoins(lottery.getJackpot())}**, quay 21h mỗi tối.`,
        '',
        '-# Ghim tin nhắn này lại để cả kênh dùng chung. Nút sống mãi, không hết hạn.',
      ].join('\n'),
    );
}

export function lobbyRows(): ActionRowBuilder<ButtonBuilder>[] {
  const game = (key: string, label: string, emoji: string, style = ButtonStyle.Secondary): ButtonBuilder =>
    new ButtonBuilder()
      .setCustomId(componentId('sanh', key))
      .setLabel(label)
      .setEmoji(emoji)
      .setStyle(style);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      game('bj', 'Blackjack', '🃏', ButtonStyle.Success),
      game('tx', 'Tài xỉu', '🎲', ButtonStyle.Success),
      game('sl', 'Máy xèng', '🎰', ButtonStyle.Success),
      game('hl', 'Cao hay Thấp', '🎴', ButtonStyle.Success),
      game('dm', 'Dò mìn', '💣', ButtonStyle.Success),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      game('bc', 'Bầu cua', '🦀'),
      game('cq', 'Cò quay', '🔫'),
      game('dn', 'Đua ngựa', '🏇'),
      game('tp', 'Triệu Phú', '💰'),
      game('xs', 'Xổ số', '🎱'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      game('vi', 'Ví', '👛', ButtonStyle.Primary),
      game('tui', 'Túi đồ', '🎒', ButtonStyle.Primary),
      game('daily', 'Điểm danh', '📅', ButtonStyle.Primary),
      game('work', 'Làm việc', '🔨', ButtonStyle.Primary),
      game('help', 'Hướng dẫn', '❓'),
    ),
  ];
}

export const sanhCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sanh')
    .setDescription('Mở sảnh sòng bạc: một bảng nút cho mọi trò, ghim lại là khỏi gõ lệnh nữa'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ embeds: [lobbyEmbed()], components: lobbyRows() });
  },
};

function betModal(game: BetGame): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(componentId('sanh', 'play', game.key))
    .setTitle(game.title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('cuoc')
          .setLabel('Tiền cược')
          .setPlaceholder('500, 1k, 2m, all, half')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(15),
      ),
    );
  if (game.pick) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('cua')
          .setLabel(game.pick.label)
          .setPlaceholder(game.pick.placeholder)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10),
      ),
    );
  }
  return modal;
}

export const lobbyComponents: ComponentHandler = {
  async handleButton(interaction: ButtonInteraction, args: string[]): Promise<void> {
    const action = args[0];
    const userId = interaction.user.id;

    const betGame = BET_GAMES.find((g) => g.key === action);
    if (betGame) {
      if (await refuseIfDown(interaction)) return;
      await interaction.showModal(betModal(betGame));
      return;
    }

    if (action === 'vi') {
      await interaction.reply({
        ...walletPanel(
          userId,
          interaction.user.displayName,
          interaction.user.displayAvatarURL(),
          interaction.inGuild() ? interaction.guildId : null,
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (action === 'tui') {
      await interaction.reply({
        ...bagPanel(userId, { tab: 'bag', selected: '' }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (action === 'help') {
      await interaction.reply({
        ...helpPanel(interaction.inGuild() ? interaction.guildId : null),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'daily') {
      if (await refuseIfDown(interaction)) return;
      const result = economy.claimDaily(userId);
      if (!result.ok) {
        await interaction.reply({
          content: 'Hôm nay bạn đã điểm danh rồi. Quay lại vào ngày mai nhé!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const house = assets.best(userId, 'nha');
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.win)
            .setTitle('📅 Điểm danh thành công!')
            .setDescription(
              [
                `**${interaction.user.displayName}** nhận **${formatCoins(result.amount)}**`,
                result.houseBonus && house
                  ? `-# ${house.emoji} ${house.name} cộng thêm ${formatCoins(result.houseBonus)}.`
                  : '',
                result.catFind ? `🐱 Mèo tha về **${formatCoins(result.catFind)}**.` : '',
                `Chuỗi điểm danh: **${result.streak} ngày** 🔥`,
              ]
                .filter(Boolean)
                .join('\n'),
            ),
        ],
      });
      return;
    }

    if (action === 'work') {
      if (await refuseIfDown(interaction)) return;
      const result = economy.work(userId);
      const retryUnix = Math.floor(result.retryAt.getTime() / 1000);
      if (!result.ok) {
        await interaction.reply({
          content: `😮‍💨 Bạn mới làm xong, nghỉ chút đã! Ca tiếp theo: <t:${retryUnix}:R>.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const rank = rankFor(result.shifts ?? 1);
      const toNext = shiftsToNext(result.shifts ?? 1);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.win)
            .setTitle('🔨 Làm việc chăm chỉ!')
            .setDescription(
              [
                `${rank.emoji} **${rank.name} ${interaction.user.displayName}** nhận **${formatCoins(result.amount)}**`,
                result.tax && result.tax > 0
                  ? `💸 Thuế thu nhập: **-${formatCoins(result.tax)}** (lương ${formatCoins(result.gross ?? 0)})`
                  : '',
                `Ca tiếp theo: <t:${retryUnix}:R>`,
                toNext > 0 ? `-# Còn ${toNext} ca nữa là lên chức.` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            ),
        ],
      });
      return;
    }

    if (action === 'dn') {
      if (await refuseIfDown(interaction)) return;
      if (!interaction.channel?.isSendable()) {
        await interaction.reply({
          content: 'Không mở được trường đua ở kênh này.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await openRace(interaction.channel);
      await interaction.editReply({ content: result.text });
      return;
    }

    if (action === 'tp') {
      if (await refuseIfDown(interaction)) return;
      await runTrieuPhu(interaction);
      return;
    }

    if (action === 'xs') {
      const info = lottery.info(userId);
      await interaction.reply({
        content: [
          `🎱 Hũ xổ số đang có **${formatCoins(info.jackpot)}**, quay 21h mỗi tối.`,
          info.myNumbers.length > 0
            ? `Vé của bạn: ${info.myNumbers.map((n) => `\`${String(n).padStart(2, '0')}\``).join(' ')}`
            : `Bạn chưa có vé. Mua bằng \`/xoso so:42\`, mỗi vé ${formatCoins(TICKET_PRICE)}.`,
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async handleModal(interaction: ModalSubmitInteraction, args: string[]): Promise<void> {
    if (args[0] !== 'play') return;
    const game = BET_GAMES.find((g) => g.key === args[1]);
    if (!game) return;

    const raw = interaction.fields.getTextInputValue('cuoc').trim();
    const bet = parseBetToken(raw, economy.getBalance(interaction.user.id));
    if (bet === null || bet < 10) {
      await interaction.reply({
        content: 'Cược không hợp lệ. Nhập số thường, hoặc `1k`, `2m`, `all`, `half`. Tối thiểu 10 xu.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (game.key === 'tx') {
      const pick = TAIXIU_PICKS[interaction.fields.getTextInputValue('cua').trim().toLowerCase()];
      if (!pick) {
        await interaction.reply({
          content: 'Cửa phải là `tai` hoặc `xiu`.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await runTaiXiu(interaction, bet, pick);
      return;
    }
    if (game.key === 'bc') {
      const pick = BAUCUA_PICKS[interaction.fields.getTextInputValue('cua').trim().toLowerCase()];
      if (!pick) {
        await interaction.reply({
          content: `Cửa phải là một trong: ${Object.values(BAU_CUA_SYMBOLS).map((s) => s.label.toLowerCase()).join(', ')}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await runBauCua(interaction, bet, pick);
      return;
    }

    const runners: Record<string, (i: ModalSubmitInteraction, b: number) => Promise<void>> = {
      bj: runBlackjack,
      sl: runSlots,
      hl: runHiLo,
      dm: runDoMin,
      cq: runCoQuay,
    };
    await runners[game.key]?.(interaction, bet);
  },
};
