import { NextResponse } from "next/server";
import { CRON_SECRET, DISCORD_BOT_TOKEN } from "@/lib/config";
import { registerGuildCommands } from "@/lib/discord/register";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const ok =
    (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) ||
    (DISCORD_BOT_TOKEN && auth === `Bearer ${DISCORD_BOT_TOKEN}`);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await registerGuildCommands();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}