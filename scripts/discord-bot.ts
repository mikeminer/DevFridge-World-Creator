/**
 * Gateway bot: slash commands work without a public Interactions Endpoint URL.
 * Leave the Developer Portal endpoint EMPTY while this process is running.
 *
 *   cp .env.example .env   # fill DISCORD_* 
 *   npm run discord:bot
 */
import { DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID } from "../lib/config";
import { handleInteraction } from "../lib/discord/handlers";
import { registerGuildCommands } from "../lib/discord/register";

type Payload = { op: number; s: number | null; t: string | null; d: unknown };

async function callback(id: string, token: string, body: unknown): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/interactions/${id}/${token}/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("interaction callback", res.status, await res.text());
  }
}

async function main() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
    throw new Error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN in .env");
  }
  const registered = await registerGuildCommands();
  console.log("commands:", registered.names.map((n) => `/${n}`).join(" "));

  const gateway = (await fetch("https://discord.com/api/v10/gateway").then((r) => r.json())) as { url: string };
  const { WebSocket } = await import("ws");
  const ws = new WebSocket(`${gateway.url}?v=10&encoding=json`);
  let seq: number | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;

  ws.on("open", () => console.log("gateway connected"));
  ws.on("close", (code, reason) => {
    console.error("gateway closed", code, reason.toString());
    process.exit(1);
  });
  ws.on("error", (err) => console.error("gateway error", err));
  ws.on("message", async (raw) => {
    const p = JSON.parse(raw.toString()) as Payload;
    if (p.s != null) seq = p.s;
    if (p.op === 10) {
      const interval = (p.d as { heartbeat_interval: number }).heartbeat_interval;
      beat = setInterval(() => {
        ws.send(JSON.stringify({ op: 1, d: seq }));
      }, interval);
      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: DISCORD_BOT_TOKEN,
            intents: 1,
            properties: { os: "windows", browser: "devfridge", device: "world-creator" },
          },
        })
      );
      return;
    }
    if (p.op === 11) return;
    if (p.t === "READY") {
      const user = (p.d as { user: { username: string } }).user;
      console.log(`ready as ${user.username} — type /world help in Discord`);
      return;
    }
    if (p.t === "INTERACTION_CREATE") {
      const interaction = p.d as { id: string; token: string; type: number };
      try {
        const payload = await handleInteraction(interaction as never);
        await callback(interaction.id, interaction.token, payload);
      } catch (err) {
        console.error(err);
        await callback(interaction.id, interaction.token, {
          type: 4,
          data: {
            flags: 64,
            content: err instanceof Error ? err.message : "World Creator error",
          },
        }).catch(() => undefined);
      }
    }
  });

  process.on("SIGINT", () => {
    if (beat) clearInterval(beat);
    ws.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
