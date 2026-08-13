import { EmbedBuilder, type Message } from 'discord.js';
import { activity, economy, lottery, prefixes } from './context.js';
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
import { openRace, placeRaceBet } from './commands/duangua.command.js';
import { buyErrorText, drawTimeUnix } from './commands/xoso.command.js';
import { MAX_TICKETS_PER_DAY } from './services/lottery.service.js';
import { parseTextCommand } from './services/prefix.service.js';
import { extractBetAndChoice, parseBetToken } from './services/bet-parse.js';
import { COLORS, formatCoins, sleep } from './embeds/format.js';

// Remember each user's last stake so `!tx tai` (no amount) repeats it.
const lastBets = new Map<string, number>();

const TAIXIU_CHOICES: Record<string, 'tai' | 'xiu'> = {
  tai: 'tai',
  tài: 'tai',
  t: 'tai',
  xiu: 'xiu',
  xỉu: 'xiu',
  x: 'xiu',
};

const COINFLIP_CHOICES: Record<string, 'ngua' | 'sap'> = {
  ngua: 'ngua',
  ngửa: 'ngua',
  n: 'ngua',
  sap: 'sap',
  sấp: 'sap',
  s: 'sap',
};

const BAUCUA_CHOICES: Record<string, BauCuaSymbol> = {
  bau: 'bau',
  bầu: 'bau',
  b: 'bau',
  cua: 'cua',
  c: 'cua',
  tom: 'tom',
  tôm: 'tom',
  t: 'tom',
  ca: 'ca',
  cá: 'ca',
  ga: 'ga',
  gà: 'ga',
  g: 'ga',
  nai: 'nai',
  n: 'nai',
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

// Every name the text layer reacts to; used for channel activity scoring.
const KNOWN_TEXT_COMMANDS = new Set([
  ...SLASH_ONLY,
  'sodu',
  'xu',
  'daily',
  'lamviec',
  'work',
  'top',
  'help',
  'xs',
  'xoso',
  'dn',
  'duangua',
  'tx',
  'taixiu',
  'bc',
  'baucua',
  'cf',
  'coinflip',
  'sl',
  'slots',
]);

/**
 * Resolve the stake from parsed args: explicit token, else the user's last
 * stake. Returns null (and hints) when nothing usable is available.
 */
async function resolveBet(
  message: Message,
  bet: number | null,
  usage: string,
): Promise<number | null> {
  const resolved = bet ?? lastBets.get(message.author.id) ?? null;
  if (resolved === null || !Number.isInteger(resolved) || resolved < 10) {
    await message.reply(
      `Cú pháp: ${usage}\nMẹo: \`1k\` = 1.000, \`1k5\` = 1.500, \`all\` = tất tay, \`half\` = nửa số dư. Bỏ trống tiền cược thì dùng lại mức lần trước.`,
    );
    return null;
  }
  return resolved;
}

async function debitOrComplain(message: Message, bet: number, game: string): Promise<boolean> {
  if (economy.debit(message.author.id, bet, 'bet', game)) {
    lastBets.set(message.author.id, bet);
    return true;
  }
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

  // Only real bot commands score the channel for the daily report.
  if (KNOWN_TEXT_COMMANDS.has(name)) {
    activity.recordChannel(message.guildId, message.channelId);
    const exempt = name === 'help' || name === 'sodu' || name === 'xu';
    const release = economy.jailedUntil(userId);
    if (release && !exempt) {
      await message.reply(
        `🚔 Đang ngồi tù thì gõ lệnh gì cũng vô ích, ra tù <t:${Math.floor(release.getTime() / 1000)}:R>! Dùng \`/nopphat\` để ra sớm.`,
      );
      return;
    }
    const discharge = economy.hospitalizedUntil(userId);
    if (discharge && !exempt) {
      await message.reply(
        `🏥 Đang nằm viện thì nghỉ ngơi đi, xuất viện <t:${Math.floor(discharge.getTime() / 1000)}:R>! Dùng \`/vienphi\` để ra sớm.`,
      );
      return;
    }
  }

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
              `\`${prefix}tx <cược> <tai|xiu>\` : Tài xỉu (viết tắt cửa: t, x)`,
              `\`${prefix}bc <cược> <bau|cua|tom|ca|ga|nai>\` : Bầu cua`,
              `\`${prefix}cf <cược> <ngua|sap>\` : Tung đồng xu (viết tắt: n, s)`,
              `\`${prefix}sl <cược>\` : Máy xèng`,
              `\`${prefix}dn\` : Mở trường đua ngựa, \`${prefix}dn <cược> <1-4>\` : vào kèo`,
              `\`${prefix}xs <số 0-99>\` : Mua vé xổ số, quay 21h mỗi tối`,
              `\`${prefix}sodu\` · \`${prefix}daily\` · \`${prefix}work\` · \`${prefix}top\``,
              '',
              '💡 Mẹo cược: `1k` = 1.000, `1k5` = 1.500, `2m` = 2 triệu, `all` = tất tay, `half` = nửa số dư.',
              `💡 Bỏ trống tiền cược thì lặp lại mức trước: \`${prefix}tx tai\`, \`${prefix}sl\`. Thứ tự tham số tùy ý.`,
              '',
              'Các trò có nút bấm (blackjack, kèo, triệu phú) dùng lệnh slash: `/help`',
            ].join('\n'),
          ),
      ],
    });
    return;
  }

  // ---- lottery ----
  if (name === 'xs' || name === 'xoso') {
    const numArg = args[0];
    if (numArg === undefined || !/^\d{1,2}$/.test(numArg)) {
      const info = lottery.info(userId);
      const myText =
        info.myNumbers.length > 0
          ? info.myNumbers.map((n) => `\`${String(n).padStart(2, '0')}\``).join(' ')
          : 'chưa có';
      await message.reply(
        `🎱 Jackpot: **${formatCoins(info.jackpot)}** · Quay <t:${drawTimeUnix(info.drawDay)}:R> · Vé của bạn: ${myText}\nMua vé: \`${prefix}xs <số 0-99>\``,
      );
      return;
    }
    const result = lottery.buy(userId, Number(numArg), message.guildId, message.channelId);
    if (!result.ok) {
      await message.reply(buyErrorText(result.error!, userId));
      return;
    }
    await message.reply(
      `🎫 Đã mua vé số **${numArg.padStart(2, '0')}** (${result.myTickets}/${MAX_TICKETS_PER_DAY}). Jackpot: **${formatCoins(result.jackpot!)}**, quay <t:${drawTimeUnix(result.drawDay!)}:R>`,
    );
    return;
  }

  // ---- horse race (shared lobby per channel) ----
  if (name === 'dn' || name === 'duangua') {
    if (tryUse(userId, 'game', 5_000) > 0) return;
    if (!message.channel.isSendable()) return;

    // Bare command opens the lobby; args place a bet on the open lobby.
    if (args.length === 0) {
      const result = await openRace(message.channel);
      await message.reply(result.text);
      return;
    }

    const balance = economy.getBalance(userId);
    let horse: number | null = null;
    let rawBet: number | null = null;
    for (const arg of args) {
      if (/^[1-4]$/.test(arg)) {
        horse = Number(arg) - 1;
        continue;
      }
      const parsed = parseBetToken(arg, balance);
      if (parsed !== null) rawBet = parsed;
    }
    if (horse === null) {
      await message.reply(`Chọn ngựa 1-4 nhé: \`${prefix}dn 100 2\` (hoặc bấm nút trên bảng đua)`);
      return;
    }
    const bet = await resolveBet(message, rawBet, `\`${prefix}dn <cược> <1-4>\``);
    if (bet === null) return;
    const result = await placeRaceBet(message.channelId, userId, username, bet, horse);
    if (result.ok) lastBets.set(userId, bet);
    await message.reply(result.text);
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

  const balance = economy.getBalance(userId);

  if (name === 'tx' || name === 'taixiu') {
    const { bet: rawBet, choice } = extractBetAndChoice(args, TAIXIU_CHOICES, balance);
    if (!choice) {
      await message.reply(
        `Chọn cửa đi: \`${prefix}${name} 100 tai\` hoặc \`${prefix}${name} 100 xiu\` (viết tắt: t, x)`,
      );
      return;
    }
    const bet = await resolveBet(message, rawBet, `\`${prefix}${name} <cược> <tai|xiu>\``);
    if (bet === null) return;
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
    const { bet: rawBet, choice } = extractBetAndChoice(args, BAUCUA_CHOICES, balance);
    if (!choice) {
      await message.reply(`Chọn linh vật đi: \`${prefix}${name} 100 <bau|cua|tom|ca|ga|nai>\``);
      return;
    }
    const bet = await resolveBet(message, rawBet, `\`${prefix}${name} <cược> <linh vật>\``);
    if (bet === null) return;
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
    const { bet: rawBet, choice } = extractBetAndChoice(args, COINFLIP_CHOICES, balance);
    if (!choice) {
      await message.reply(
        `Chọn mặt đi: \`${prefix}${name} 100 ngua\` hoặc \`${prefix}${name} 100 sap\` (viết tắt: n, s)`,
      );
      return;
    }
    const bet = await resolveBet(message, rawBet, `\`${prefix}${name} <cược> <ngua|sap>\``);
    if (bet === null) return;
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
  const rawBet = args[0] ? parseBetToken(args[0], balance) : null;
  const bet = await resolveBet(message, rawBet, `\`${prefix}${name} <cược>\``);
  if (bet === null) return;
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
