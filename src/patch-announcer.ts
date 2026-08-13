import { EmbedBuilder, type Client } from 'discord.js';
import { activity, reports } from './context.js';
import { LATEST_PATCH, type PatchNote } from './data/patch-notes.js';
import { COLORS } from './embeds/format.js';

export function patchEmbed(note: PatchNote): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.playing)
    .setTitle(`🚀 Bản cập nhật v${note.version}: ${note.title}`)
    .setDescription(note.changes.map((c) => `• ${c}`).join('\n'))
    .setFooter({ text: `Phát hành ${note.date} · Xem lại: /patchnote xem` });
}

/** Announce the newest patch once per guild, right after a deploy. */
export async function announcePatchNotes(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      if (!reports.patchDue(guild.id, LATEST_PATCH.version)) continue;
      // Mark first: a broken channel should not retry on every restart.
      reports.markPatchSent(guild.id, LATEST_PATCH.version);

      const config = reports.getConfig(guild.id);
      const candidates = [
        config.patchChannelId,
        config.channelId,
        activity.topChannel(guild.id),
        guild.systemChannelId,
      ].filter((id): id is string => Boolean(id));

      for (const channelId of candidates) {
        try {
          const channel = await client.channels.fetch(channelId);
          if (!channel?.isSendable()) continue;
          await channel.send({ embeds: [patchEmbed(LATEST_PATCH)] });
          console.log(`[patch] Announced v${LATEST_PATCH.version} in ${guild.name}`);
          break;
        } catch (error) {
          console.warn(`[patch] Cannot post in ${channelId}: ${String(error)}`);
        }
      }
    } catch (error) {
      console.error(`[patch] Failed for guild ${guild.id}:`, error);
    }
  }
}
