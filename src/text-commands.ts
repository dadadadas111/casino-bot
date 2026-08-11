import { EmbedBuilder, type Message } from 'discord.js';
import { economy, prefixes } from './context.js';
import { tryUse } from './services/cooldown.service.js';
import {
  BAU_CUA_SYMBOLS,
  type BauCuaSymbol,
  DICE_EMOJI,
  bauCuaPayout,
  coinflipPayout,
  flipCoin,
  rollBauCua,
  rollTaiXiu,
  slotsPayout,
  spinSlots,
  taiXiuPayout,
} from './services/minigames.service.js';
import { resultLine } from './commands/bet-helpers.js';
import { parseTextCommand } from './services/prefix.service.js';
import { COLORS, formatCoins, sleep } from './embeds/format.js';

const TAIXIU_CHOICES: Record<string, 'tai' | 'xiu'> = {
  tai: 'tai',
  tài: 'tai',
  xiu: 'xiu',
  xỉu: 'xiu',
};

const COINFLIP_CHOICES: Record<string, 'ngua' | 'sap'> = {
  ngua: 'ngua',
  ngửa: 'ngua',
  sap: 'sap',
  sấp: 'sap',
};

const BAUCUA_CHOICES: Record<string, BauCuaSymbol> = {
  bau: 'bau',
  bầu: 'bau',
  cua: 'cua',
  tom: 'tom',
  tôm: 'tom',
  ca: 'ca',
  cá: 'ca',
  ga: 'ga',
  gà: 'ga',
  nai: 'nai',
};

// Commands that exist only as slash commands (buttons/ephemeral involved).
const SLASH_ONLY = new Set([
  'blackjack',
  'bj',
  'keo',
  'trieuphu',
  'tp',
  'lichsu',
  'chuyentien',
  'setprefix',
]);

function parseBet(raw: string | undefined): number | null {
  const bet = Number(raw);
  return Number.isInteger(bet) && bet >= 10 ? bet : null;
}

async function debitOrComplain(message: Message, bet: number, game: string): Promise<boolean> {
  if (economy.debit(message.author.id, bet, 'bet', game)) return true;
  await message.reply(
    `Không đủ xu! Số dư của bạn: ${formatCoins(economy.getBalance(message.author.id))}. Dùng \`/daily\` hoặc \`/lamviec\` để kiếm xu.`,
  );
  return false;
}

function gameEmbed(title: string, lines: string[], win: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(win ? COLORS.win : COLORS.lose)
    .setTitle(title)
    .setDescription(lines.join('\n'));
}

export async function handleTextCommand(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  const prefix = prefixes.get(message.guildId);
  const parsed = parseTextCommand(message.content, prefix);
  if (!parsed) return;
  const { name, args } = parsed;
  const userId = message.author.id;
  const username = message.author.displayName;

  if (SLASH_ONLY.has(name)) {
    await message.reply(`Lệnh này dùng bản slash nhé: \`/${name === 'bj' ? 'blackjack' : name === 'tp' ? 'trieuphu' : name}\``);
    return;
  }

  // ---- economy quick commands ----
  if (name === 'sodu' || name === 'xu') {
    const profile = economy.getProfile(userId);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setDescription(
            `💰 **${username}**: ${formatCoins(profile.balance)} (hạng #${profile.rank})`,
          ),
      ],
    });
    return;
  }

  if (name === 'daily') {
    const result = economy.claimDaily(userId);
    await message.reply(
      result.ok
        ? `📅 Điểm danh thành công! +${formatCoins(result.amount)}, chuỗi **${result.streak} ngày** 🔥`
        : 'Hôm nay bạn đã điểm danh rồi. Quay lại vào ngày mai nhé!',
    );
    return;
  }

  if (name === 'lamviec' || name === 'work') {
    const result = economy.work(userId);
    const retryUnix = Math.floor(result.retryAt.getTime() / 1000);
    await message.reply(
      result.ok
        ? `🔨 Làm việc xong, nhận ${formatCoins(result.amount)}! Ca tiếp theo: <t:${retryUnix}:R>`
        : `😮‍💨 Nghỉ chút đã! Ca tiếp theo: <t:${retryUnix}:R>`,
    );
    return;
  }

  if (name === 'top') {
    if (tryUse(userId, 'top', 10_000) > 0) return;
    const rows = economy.topByBalance(10);
    const medals = ['🥇', '🥈', '🥉'];
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.gold)
          .setTitle('🏆 Bảng xếp hạng sòng bạc')
          .setDescription(
            rows
              .map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.userId}> : ${formatCoins(r.balance)}`)
              .join('\n'),
          ),
      ],
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (name === 'help') {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('⚡ Lệnh nhắn nhanh')
          .setDescription(
            [
              `\`${prefix}tx <cược> <tai|xiu>\` : Tài xỉu`,
              `\`${prefix}bc <cược> <bau|cua|tom|ca|ga|nai>\` : Bầu cua`,
              `\`${prefix}cf <cược> <ngua|sap>\` : Tung đồng xu`,
              `\`${prefix}slots <cược>\` : Máy xèng`,
              `\`${prefix}sodu\` · \`${prefix}daily\` · \`${prefix}work\` · \`${prefix}top\``,
              '',
              'Các trò có nút bấm (blackjack, kèo, triệu phú) dùng lệnh slash: `/help`',
            ].join('\n'),
          ),
      ],
    });
    return;
  }

  // ---- one-shot games ----
  const isGame = ['tx', 'taixiu', 'bc', 'baucua', 'cf', 'coinflip', 'sl', 'slots'].includes(name);
  if (!isGame) return; // unknown text command: stay silent

  const remaining = tryUse(userId, 'game', 5_000);
  if (remaining > 0) {
    await message.reply(`⏳ Từ từ thôi! Thử lại sau ${Math.ceil(remaining / 1000)} giây.`);
    return;
  }

  const bet = parseBet(args[0]);
  if (bet === null) {
    await message.reply(`Cú pháp: \`${prefix}${name} <cược từ 10 xu>\``);
    return;
  }

  if (name === 'tx' || name === 'taixiu') {
    const choice = TAIXIU_CHOICES[args[1]?.toLowerCase() ?? ''];
    if (!choice) {
      await message.reply(`Chọn cửa đi: \`${prefix}${name} ${bet} tai\` hoặc \`${prefix}${name} ${bet} xiu\``);
      return;
    }
    if (!(await debitOrComplain(message, bet, 'taixiu'))) return;
    const sent = await message.reply('🎲 Đang lắc...');
    await sleep(1200);
    const result = rollTaiXiu();
    const payout = taiXiuPayout(result, choice, bet);
    economy.settleGame(userId, bet, payout, 'taixiu');
    const diceText = result.dice.map((d) => `${DICE_EMOJI[d]} ${d}`).join('  ');
    const outcome = result.outcome === 'bao' ? `BÃO (${result.total})` : `${result.outcome === 'tai' ? 'TÀI' : 'XỈU'} (${result.total})`;
    await sent.edit({
      content: '',
      embeds: [
        gameEmbed(`🎲 Tài Xỉu: ${outcome}`, [
          `Kết quả: ${diceText}`,
          resultLine(payout, bet),
          `Số dư mới: ${formatCoins(economy.getBalance(userId))}`,
        ], payout > 0),
      ],
    });
    return;
  }

  if (name === 'bc' || name === 'baucua') {
    const choice = BAUCUA_CHOICES[args[1]?.toLowerCase() ?? ''];
    if (!choice) {
      await message.reply(`Chọn linh vật đi: \`${prefix}${name} ${bet} <bau|cua|tom|ca|ga|nai>\``);
      return;
    }
    if (!(await debitOrComplain(message, bet, 'baucua'))) return;
    const sent = await message.reply('🎲 Đang lắc...');
    await sleep(1200);
    const result = rollBauCua(choice);
    const payout = bauCuaPayout(result, bet);
    economy.settleGame(userId, bet, payout, 'baucua');
    const diceText = result.dice.map((d) => `${BAU_CUA_SYMBOLS[d].emoji} ${BAU_CUA_SYMBOLS[d].label}`).join('  |  ');
    await sent.edit({
      content: '',
      embeds: [
        gameEmbed('🦀 Bầu Cua: Kết quả', [
          `Kết quả: ${diceText}`,
          `Bạn đặt ${BAU_CUA_SYMBOLS[choice].emoji}, trúng **${result.matches}** mặt.`,
          resultLine(payout, bet),
          `Số dư mới: ${formatCoins(economy.getBalance(userId))}`,
        ], payout > 0),
      ],
    });
    return;
  }

  if (name === 'cf' || name === 'coinflip') {
    const choice = COINFLIP_CHOICES[args[1]?.toLowerCase() ?? ''];
    if (!choice) {
      await message.reply(`Chọn mặt đi: \`${prefix}${name} ${bet} ngua\` hoặc \`${prefix}${name} ${bet} sap\``);
      return;
    }
    if (!(await debitOrComplain(message, bet, 'coinflip'))) return;
    const sent = await message.reply('🪙 Đồng xu đang xoay...');
    await sleep(1000);
    const result = flipCoin();
    const payout = coinflipPayout(result, choice, bet);
    economy.settleGame(userId, bet, payout, 'coinflip');
    await sent.edit({
      content: '',
      embeds: [
        gameEmbed(`🪙 Kết quả: ${result.side === 'ngua' ? 'NGỬA 🌕' : 'SẤP 🌑'}`, [
          resultLine(payout, bet),
          `Số dư mới: ${formatCoins(economy.getBalance(userId))}`,
        ], payout > 0),
      ],
    });
    return;
  }

  // slots
  if (!(await debitOrComplain(message, bet, 'slots'))) return;
  const sent = await message.reply('🎰 | ❓ ❓ ❓ |');
  await sleep(1200);
  const result = spinSlots();
  const payout = slotsPayout(result, bet);
  economy.settleGame(userId, bet, payout, 'slots');
  await sent.edit({
    content: '',
    embeds: [
      gameEmbed('🎰 Máy xèng: Kết quả', [
        `🎰 | ${result.reels.join(' ')} |`,
        result.kind === 'triple' ? `✨ **JACKPOT!** Trúng x${result.multiplier}!` : '',
        resultLine(payout, bet),
        `Số dư mới: ${formatCoins(economy.getBalance(userId))}`,
      ].filter(Boolean), payout > bet),
    ],
  });
}
