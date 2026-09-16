import "./load-env";
import { COMMITMENT_COPY, TAGLINE } from "../lib/copy";
import { DISCORD_BOT_TOKEN, DISCORD_CREATOR_CHANNEL_ID, PASTA_MINT, WORLD_URL } from "../lib/config";

const content = [
  "🍝 **DevFridge World Creator is live in this channel.**",
  "",
  TAGLINE,
  "",
  "This is the standard pipeline for an external meme community to apply a character to **the next seasons** of DevFridge World — not a shortcut into the current official kitchen cast.",
  "",
  "Flow: `/world create` → rights declaration → AI 3D preview → you confirm → DevFridge review → $PASTA commitment → eligibility while the verified lock is active.",
  "",
  COMMITMENT_COPY,
  "",
  `Commands: \`/world create\` · \`/world status\` · \`/world preview\` · \`/world my-assets\` · \`/world optout\` · \`/world report\` · \`/world help\``,
  "",
  `$PASTA mint \`${PASTA_MINT}\` · ticker ≠ identity`,
  `Game: ${WORLD_URL}`,
  "Official contacts only on https://connect.devfridge.cool",
  "DevFridge never asks for a seed phrase.",
].join("\n");

async function main() {
  if (!DISCORD_BOT_TOKEN) throw new Error("Set DISCORD_BOT_TOKEN");
  const res = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CREATOR_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      embeds: [
        {
          color: 0xed4a35,
          title: "Season pipeline",
          description:
            "Current World season uses the official ten-character kitchen. Community submissions become eligible only after rights + review + a verified on-chain $PASTA commitment. Opt-out removes the asset from the game; it does not unlock the lock early.",
        },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  console.log(`Posted intro to channel ${DISCORD_CREATOR_CHANNEL_ID}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
