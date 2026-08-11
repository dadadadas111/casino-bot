import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { env } from './config/env.js';
import { commands } from './commands/index.js';
import { routeComponent } from './interactions/registry.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function registerGuildCommands(guildId: string, guildName: string): Promise<void> {
  try {
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
    await rest.put(Routes.applicationGuildCommands(client.application!.id, guildId), { body });
    console.log(`[bot] Registered ${body.length} commands to guild ${guildName} (${guildId})`);
  } catch (error) {
    console.error(`[bot] Failed to register commands to guild ${guildName}:`, error);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Logged in as ${c.user.tag} (${commands.size} commands loaded)`);
  // Re-register on every boot so command changes ship with each deploy.
  for (const guild of c.guilds.cache.values()) {
    await registerGuildCommands(guild.id, guild.name);
  }
});

// Register the moment the bot is invited, so no manual deploy-commands run
// is needed after an admin accepts the invite.
client.on(Events.GuildCreate, (guild) => void registerGuildCommands(guild.id, guild.name));

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      await routeComponent(interaction);
    }
  } catch (error) {
    console.error('[bot] Interaction error:', error);
    if (interaction.isRepliable()) {
      const message = {
        content: 'Có lỗi xảy ra, thử lại sau nhé!',
        flags: MessageFlags.Ephemeral,
      } as const;
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(message);
        } else {
          await interaction.reply(message);
        }
      } catch {
        // Interaction already expired; nothing left to do.
      }
    }
  }
});

client.login(env.DISCORD_TOKEN).catch((error) => {
  console.error('[bot] Login failed:', error);
  process.exit(1);
});
