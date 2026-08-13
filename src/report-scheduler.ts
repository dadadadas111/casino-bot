import { EmbedBuilder, type Client } from 'discord.js';
import { activity, lottery, reports } from './context.js';
import { env } from './config/env.js';
import { vnDay } from './services/economy.service.js';
import { generateComments } from './services/commentary.service.js';
import { GAME_LABELS } from './embeds/history-table.js';
import { findAnnounceChannel } from './utils/announce.js';
import { COLORS, formatCoins } from './embeds/format.js';

const CHECK_INTERVAL_MS = 60_000;
const MEDALS = ['🥇', '🥈', '🥉'];

// One AI commentary generation per guild per day; /bantin xem reuses it.
const commentCache = new Map<string, string[]>();

async function commentsFor(guildId: string, facts: string[][]): Promise<string[]> {
  const fallback = facts.map((f) => f[1] ?? f[0] ?? '');
  if (!env.DEEPSEEK_API_KEY || facts.length === 0) return fallback;
  const cacheKey = `${guildId}:${vnDay(new Date())}:${facts.length}`;
  const cached = commentCache.get(cacheKey);
  if (cached) return cached;
  const generated = await generateComments(
    env.DEEPSEEK_API_KEY,
    facts.map((f) => ({ facts: f })),
  );
  const comments = generated ?? fallback;
  commentCache.set(cacheKey, comments);
  if (commentCache.size > 200) commentCache.clear();
  return comments;
}

export async function buildReportEmbed(guildId: string, guildName: string): Promise<EmbedBuilder> {
  const top = reports.playerProfiles(guildId, 10);
  const players = reports.guildPlayerCount(guildId);
  const games = reports.gameStats24h();
  const movers = reports.topMovers24h(guildId);
  const jackpot = lottery.getJackpot();

  const comments = await commentsFor(
    guildId,
    top.map((p) => p.facts),
  );
  const topText =
    top.length > 0
      ? top
          .map((u, i) => {
            const line = `${MEDALS[i] ?? `**${i + 1}.**`} <@${u.userId}> · ${formatCoins(u.balance)} · ${u.gamesPlayed} ván`;
            const comment = comments[i];
            return comment ? `${line}\n-# ${comment}` : line;
          })
          .join('\n')
      : 'Chưa có ai chơi. Gõ `/help` để bắt đầu!';

  const totalBets = games.reduce((sum, g) => sum + g.bets, 0);
  const gamesText =
    games.length > 0
      ? games
          .slice(0, 5)
          .map((g) => `${GAME_LABELS[g.game] ?? g.game} ${g.bets}`)
          .join(' · ')
      : 'Không có lượt cược nào.';

  const moverLines: string[] = [];
  if (movers.winner) {
    moverLines.push(`📈 Nóng nhất: <@${movers.winner.userId}> **+${formatCoins(movers.winner.net)}**`);
  }
  if (movers.loser) {
    moverLines.push(`📉 Đen nhất: <@${movers.loser.userId}> **-${formatCoins(-movers.loser.net)}**`);
  }

  const today = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date());

  // Top-10 with commentary can exceed the 1024-char field cap, so it lives
  // in the description (4096).
  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`📰 Bản tin sòng bạc ${today} · ${guildName}`)
    .setDescription(
      `👥 Người chơi trong server: **${players}**\n\n🏆 **Top 10 đại gia**\n${topText}`,
    )
    .addFields(
      {
        name: `🎮 24h qua: ${totalBets} lượt cược (toàn sòng)`,
        value: [gamesText, ...moverLines].join('\n'),
      },
      {
        name: '🎱 Xổ số',
        value: `Jackpot đang là **${formatCoins(jackpot)}**, quay 21h tối nay. Mua vé: \`/xoso mua\``,
      },
    )
    .setFooter({ text: 'Xem lại: /bantin xem · Cấu hình: /bantin config' });
}

/** Post the daily report for one guild; returns true when it was delivered. */
async function sendReport(client: Client, guildId: string): Promise<boolean> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  const config = reports.getConfig(guildId);

  const channel = await findAnnounceChannel(guild, [
    config.channelId,
    activity.topChannel(guildId),
    guild.systemChannelId,
  ]);
  if (!channel) return false;

  try {
    await channel.send({
      content: config.tagEveryone ? '@everyone Bản tin sòng bạc hôm nay đã ra lò! 📰' : undefined,
      embeds: [await buildReportEmbed(guildId, guild.name)],
      allowedMentions: config.tagEveryone ? { parse: ['everyone'] } : { parse: [] },
    });
    return true;
  } catch (error) {
    console.warn(`[bantin] Cannot send in ${guild.name}: ${String(error)}`);
    return false;
  }
}

export function startReportScheduler(client: Client): void {
  setInterval(() => void checkReports(client), CHECK_INTERVAL_MS);
}

async function checkReports(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      if (!reports.isDue(guild.id)) continue;
      // Mark first so a failing guild does not retry every minute for an hour.
      reports.markSent(guild.id);
      const delivered = await sendReport(client, guild.id);
      console.log(`[bantin] ${guild.name}: ${delivered ? 'sent' : 'no usable channel'}`);
    } catch (error) {
      console.error(`[bantin] Failed for guild ${guild.id}:`, error);
    }
  }
  activity.pruneOldChannelActivity();
}
