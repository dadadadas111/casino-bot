import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { env } from './config/env.js';
import { commands } from './commands/index.js';
import { routeComponent } from './interactions/registry.js';
import { tryUse } from './services/cooldown.service.js';
import { handleTextCommand } from './text-commands.js';
import { startLotteryScheduler } from './lottery-scheduler.js';
import { startReportScheduler } from './report-scheduler.js';
import { activity } from './context.js';

// Message prefix commands need the privileged MessageContent intent (portal
// toggle required), so they sit behind an env flag to avoid login crashes.
const prefixCommandsEnabled = env.ENABLE_PREFIX_COMMANDS === 'true';

// Per-user spam control. Aliases share their command's cooldown key, so /bj
// and /blackjack count against the same window. /lamviec and /daily manage
// their own long cooldowns in the database.
const GAME_CD = { key: 'game', ms: 5_000 };
const TUONGTAC_CD = { key: 'tuongtac', ms: 15_000 };
const COOLDOWNS: Record<string, { key: string; ms: number }> = {
  blackjack: GAME_CD,
  bj: GAME_CD,
  taixiu: GAME_CD,
  tx: GAME_CD,
  baucua: GAME_CD,
  bc: GAME_CD,
  coinflip: GAME_CD,
  cf: GAME_CD,
  slots: GAME_CD,
  keo: { key: 'keo', ms: 30_000 },
  duangua: GAME_CD,
  dn: GAME_CD,
  xoso: GAME_CD,
  xs: GAME_CD,
  om: TUONGTAC_CD,
  hon: TUONGTAC_CD,
  danh: TUONGTAC_CD,
  choc: TUONGTAC_CD,
  xoadau: TUONGTAC_CD,
  top: { key: 'top', ms: 10_000 },
  bantin: { key: 'bantin', ms: 30_000 },
};

const client = new Client({
  intents: prefixCommandsEnabled
    ? [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    : [GatewayIntentBits.Guilds],
});

if (prefixCommandsEnabled) {
  client.on(Events.MessageCreate, (message) => {
    // Channel/user activity feeds the daily report's busiest-channel pick.
    if (!message.author.bot && message.inGuild()) {
      try {
        activity.recordChannel(message.guildId, message.channelId);
        activity.recordUser(message.guildId, message.author.id);
      } catch (error) {
        console.error('[activity] Failed to record message activity:', error);
      }
    }
    void handleTextCommand(message).catch((error) =>
      console.error('[text] Command error:', error),
    );
  });
}

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
  startLotteryScheduler(client);
  startReportScheduler(client);
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
      if (interaction.inGuild() && interaction.channelId) {
        activity.recordUser(interaction.guildId, interaction.user.id);
        activity.recordChannel(interaction.guildId, interaction.channelId);
      }
      const cooldown = COOLDOWNS[interaction.commandName];
      if (cooldown) {
        const remaining = tryUse(interaction.user.id, cooldown.key, cooldown.ms);
        if (remaining > 0) {
          await interaction.reply({
            content: `⏳ Từ từ thôi! Thử lại sau ${Math.ceil(remaining / 1000)} giây nữa.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      await command.execute(interaction);
    } else if (interaction.isButton() || interaction.isModalSubmit()) {
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
