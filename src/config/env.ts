import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DB_PATH: z.string().default('./data/casino.db'),
  // Optional: enables AI-generated trieuphu questions; falls back to the static bank.
  DEEPSEEK_API_KEY: z.string().optional(),
  // 'true' enables message prefix commands. REQUIRES the Message Content
  // privileged intent to be toggled on in the Developer Portal first,
  // otherwise the bot fails to log in with "Used disallowed intents".
  ENABLE_PREFIX_COMMANDS: z.string().default('false'),
  // Discord user id allowed to grant premium cash (manual top-ups).
  BOT_OWNER_ID: z.string().optional(),
  // SePay top-ups. Without SEPAY_API_KEY the webhook server stays off.
  SEPAY_API_KEY: z.string().optional(),
  SEPAY_PORT: z.coerce.number().default(3020),
  SEPAY_BANK: z.string().default('MBBank'),
  SEPAY_ACCOUNT: z.string().default(''),
  SEPAY_HOLDER: z.string().default(''),
  // Admin dashboard; all three must be set for it to serve.
  DASHBOARD_EMAIL: z.string().optional(),
  DASHBOARD_PASSWORD_HASH: z.string().optional(),
  DASHBOARD_SESSION_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('[env] Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

export const env = parsed.data;
