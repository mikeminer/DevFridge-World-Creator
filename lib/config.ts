export const PASTA_MINT =
  process.env.PASTA_MINT ||
  process.env.NEXT_PUBLIC_PASTA_MINT ||
  "39kMeX4HVRW9qbbiHSPbRQ9xeXUF18GrNP6gL61Ppump";

export const PROGRAM_ID =
  process.env.DEVFRIDGE_PROGRAM_ID ||
  process.env.NEXT_PUBLIC_DEVFRIDGE_PROGRAM_ID ||
  "9RY54dNPYTzDyh3TfFqDdt2b2KMM56KW1tw9erRTGQo6";

export const PASTA_DECIMALS = 6;
export const CLAIM_BURN_BPS = 200; // 2%

export const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
export const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

/** DevFridge Discord — https://discord.com/channels/1190606959246835764/1549687923350175784 */
export const DISCORD_REVIEW_GUILD_ID =
  process.env.DISCORD_REVIEW_GUILD_ID || "1190606959246835764";
export const DISCORD_CREATOR_CHANNEL_ID =
  process.env.DISCORD_CREATOR_CHANNEL_ID || "1549687923350175784";
export const DISCORD_REVIEW_CHANNEL_ID =
  process.env.DISCORD_REVIEW_CHANNEL_ID || "1549687923350175784";

export const DISCORD_ADMIN_USER_IDS = (process.env.DISCORD_ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const DISCORD_ADMIN_ROLE_ID = process.env.DISCORD_ADMIN_ROLE_ID || "";

export const CREATOR_BASE_URL = (
  process.env.CREATOR_BASE_URL ||
  process.env.NEXT_PUBLIC_CREATOR_BASE_URL ||
  "http://localhost:3020"
).replace(/\/$/, "");

export const SESSION_SECRET = process.env.SESSION_SECRET || "devfridge-world-creator-dev";
export const CRON_SECRET = process.env.CRON_SECRET || "";

export const DATABASE_URL = process.env.DATABASE_URL || "";

export const THREED_PROVIDER = (process.env.THREED_PROVIDER || "placeholder").toLowerCase();
export const MESHY_API_KEY = process.env.MESHY_API_KEY || "";

export const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || "mainnet-beta";
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (SOLANA_CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com");

export const RIGHTS_POLICY_VERSION = process.env.RIGHTS_POLICY_VERSION || "2026-09-15";
export const CREATOR_TERMS_VERSION = process.env.CREATOR_TERMS_VERSION || "2026-09-15";

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 4;
export const GLB_HARD_MAX_BYTES = 20 * 1024 * 1024;
export const GLB_MAX_TRIANGLES = 100_000;
export const GENERATION_MAX_ATTEMPTS = 3;

export const DURATION_SECONDS: Record<string, number> = {
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  "90d": 90 * 24 * 60 * 60,
};

export const QUOTE_PASTA: Record<string, number> = {
  "7d": Number(process.env.QUOTE_PASTA_7D || 100_000),
  "30d": Number(process.env.QUOTE_PASTA_30D || 500_000),
  "90d": Number(process.env.QUOTE_PASTA_90D || 1_500_000),
};

export const QUOTE_TTL_HOURS = Number(process.env.QUOTE_TTL_HOURS || 24);

export const WORLD_URL = "https://world.devfridge.cool";
export const DOCS_WORLD_URL = "https://docs.devfridge.cool/world";
export const DOCS_FRIDGE_URL = "https://docs.devfridge.cool/fridge";
export const CONNECT_URL = "https://connect.devfridge.cool";
export const PASTA_URL = `https://pump.fun/coin/${PASTA_MINT}`;

export function pastaToBaseUnits(whole: number): bigint {
  return BigInt(Math.round(whole)) * 10n ** BigInt(PASTA_DECIMALS);
}

export function baseUnitsToPasta(units: bigint | string): number {
  const n = typeof units === "bigint" ? units : BigInt(units);
  return Number(n) / 10 ** PASTA_DECIMALS;
}
