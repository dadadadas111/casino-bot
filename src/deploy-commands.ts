import { REST, Routes } from 'discord.js';
import { env } from './config/env.js';
import { commands } from './commands/index.js';

/**
 * Register slash commands with Discord. Run after every command change:
 *   pnpm deploy-commands
 */
const commandsJson = [...commands.values()].map((cmd) => cmd.data.toJSON());

async function deploy(): Promise<void> {
  if (!env.DISCORD_CLIENT_ID) {
    console.error('Missing DISCORD_CLIENT_ID in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  console.log(`[deploy] Registering ${commandsJson.length} commands...`);

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
      body: commandsJson,
    });
    console.log(`[deploy] Registered to guild ${env.DISCORD_GUILD_ID} (instant)`);
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commandsJson });
    console.log('[deploy] Registered globally (may take up to 1 hour to appear)');
  }
}

deploy().catch((error) => {
  console.error('[deploy] Failed:', error);
  process.exit(1);
});
