import type { BaseMessageOptions, Message, RepliableInteraction } from 'discord.js';

/**
 * Post a public message from an interaction whose own reply is ephemeral.
 * Goes through the channel so the result is public regardless of how the
 * interaction was answered, and falls back to a follow-up when the channel
 * is not send-capable from here.
 */
export async function announce(
  interaction: RepliableInteraction,
  payload: BaseMessageOptions,
): Promise<Message | null> {
  const channel = interaction.channel;
  if (channel?.isSendable()) {
    try {
      return await channel.send(payload);
    } catch (error) {
      console.error('[announce] Channel send failed, falling back:', error);
    }
  }
  try {
    return await interaction.followUp(payload);
  } catch (error) {
    console.error('[announce] Follow-up failed:', error);
    return null;
  }
}
