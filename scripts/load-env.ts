import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const examplePath = resolve(process.cwd(), ".env.example");

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.error("Created .env from .env.example.");
  } else {
    console.error("Missing .env and .env.example.");
    process.exit(1);
  }
}

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
}

const missing = ["DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY", "DISCORD_BOT_TOKEN"].filter(
  (key) => !process.env[key]
);
if (missing.length) {
  console.error(`Fill these in .env, then run again:\n  ${missing.join("\n  ")}`);
  console.error("Discord Developer Portal → your app → General Information (ID + Public Key) and Bot (token).");
  process.exit(1);
}
