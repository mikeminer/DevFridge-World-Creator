import { COMMANDS } from "../lib/discord/commands";
import { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_REVIEW_GUILD_ID } from "../lib/config";

async function main() {
  if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
    throw new Error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN");
  }
  const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_REVIEW_GUILD_ID}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(COMMANDS),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  const cmds = JSON.parse(body) as { name: string }[];
  console.log(`Registered ${cmds.length} guild commands on ${DISCORD_REVIEW_GUILD_ID}:`);
  for (const c of cmds) console.log(`  /${c.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
