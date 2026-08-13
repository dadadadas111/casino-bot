import { ChannelType, PermissionFlagsBits, type Guild, type SendableChannels } from 'discord.js';

/**
 * Pick a channel the bot can actually post in.
 *
 * Command-usage scoring can crown a channel where the bot may reply to
 * interactions but not send messages of its own, so every candidate is
 * permission-checked and there is a last-resort sweep over the guild.
 */
export async function findAnnounceChannel(
  guild: Guild,
  preferred: Array<string | null | undefined>,
): Promise<SendableChannels | null> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return null;

  const usable = (channel: unknown): channel is SendableChannels => {
    const c = channel as SendableChannels & {
      isSendable?: () => boolean;
      permissionsFor?: (m: typeof me) => { has: (p: bigint) => boolean } | null;
    };
    if (!c?.isSendable?.()) return false;
    const perms = c.permissionsFor?.(me);
    return Boolean(
      perms?.has(PermissionFlagsBits.ViewChannel) &&
        perms.has(PermissionFlagsBits.SendMessages) &&
        perms.has(PermissionFlagsBits.EmbedLinks),
    );
  };

  for (const id of preferred) {
    if (!id) continue;
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (usable(channel)) return channel;
  }

  const fallback = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildText)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .find((c) => usable(c));
  return fallback ? (fallback as unknown as SendableChannels) : null;
}
