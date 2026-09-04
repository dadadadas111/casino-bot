import { AttachmentBuilder, type Client, type EmbedBuilder } from 'discord.js';
import { renderWeddingCard } from './wedding-card.js';

export const CARD_NAME = 'wedding.png';

/**
 * A composed card of the couple ([avatar] heart [avatar]), or null when it
 * cannot be rendered (a missing avatar), so the caller falls back to coupleFaces.
 */
export async function coupleCard(
  url1: string | null,
  url2: string | null,
  broken = false,
): Promise<AttachmentBuilder | null> {
  const buf = await renderWeddingCard(url1, url2, broken);
  return buf ? new AttachmentBuilder(buf, { name: CARD_NAME }) : null;
}

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
