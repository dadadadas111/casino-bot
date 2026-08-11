import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { env } from './config/env.js';
import { commands } from './commands/index.js';
import { routeComponent } from './interactions/registry.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Logged in as ${c.user.tag} (${commands.size} commands loaded)`);
});

// Register slash commands the moment the bot is invited to a guild, so no
// manual deploy-commands run is needed after an admin accepts the invite.
client.on(Events.GuildCreate, async (guild) => {
  try {
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
    await rest.put(Routes.applicationGuildCommands(guild.client.application.id, guild.id), {
      body,
    });
    console.log(`[bot] Registered ${body.length} commands to guild ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error('[bot] Failed to register commands on guild join:', error);
  }
});

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
