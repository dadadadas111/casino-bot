import type { Client, EmbedBuilder } from 'discord.js';

/** Best-effort avatar URL for a real user, or null if it cannot be fetched. */
export async function userAvatar(client: Client, userId: string): Promise<string | null> {
  try {
    const user = await client.users.fetch(userId);
    return user.displayAvatarURL();
  } catch {
    return null;
  }
}

/**
 * Put both faces of a couple on a wedding embed: one on the byline, the other
 * as the thumbnail. Whichever is missing is simply skipped.
 */
export function coupleFaces(
  embed: EmbedBuilder,
  bylineName: string,
  bylineAvatar: string | null,
  partnerAvatar: string | null,
): void {
  embed.setAuthor({ name: bylineName, iconURL: bylineAvatar ?? undefined });
  if (partnerAvatar) embed.setThumbnail(partnerAvatar);
}
