import { readFileSync } from 'node:fs';
import { REST, Routes } from 'discord.js';
import { env } from './config/env.js';

/**
 * One-off: set the bot user avatar and the application icon (the image shown
 * next to every slash command). Run from the repo root: pnpm set-avatar
 */
const png = readFileSync('assets/avatar.png');
const dataUri = `data:image/png;base64,${png.toString('base64')}`;
const rest = new REST().setToken(env.DISCORD_TOKEN);

await rest.patch(Routes.user(), { body: { avatar: dataUri } });
console.log('[avatar] Bot avatar updated');

await rest.patch(Routes.currentApplication(), { body: { icon: dataUri } });
console.log('[avatar] Application icon updated');
