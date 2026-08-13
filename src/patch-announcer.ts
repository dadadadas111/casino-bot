import { EmbedBuilder, type Client } from 'discord.js';
import { activity, reports } from './context.js';
import { LATEST_PATCH, type PatchNote } from './data/patch-notes.js';
import { findAnnounceChannel } from './utils/announce.js';
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

      const config = reports.getConfig(guild.id);
      const channel = await findAnnounceChannel(guild, [
        config.patchChannelId,
        config.channelId,
        activity.topChannel(guild.id),
        guild.systemChannelId,
      ]);
      if (!channel) {
        console.warn(`[patch] No postable channel in ${guild.name}, will retry next boot`);
        continue;
      }

      await channel.send({ embeds: [patchEmbed(LATEST_PATCH)] });
      // Mark only after delivery so a failure retries on the next boot.
      reports.markPatchSent(guild.id, LATEST_PATCH.version);
      console.log(`[patch] Announced v${LATEST_PATCH.version} in ${guild.name}`);
    } catch (error) {
      console.error(`[patch] Failed for guild ${guild.id}:`, error);
    }
  }
}
