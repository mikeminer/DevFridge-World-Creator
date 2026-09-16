import { NextResponse } from "next/server";
import { DISCORD_APPLICATION_ID, DISCORD_CREATOR_CHANNEL_ID, DISCORD_REVIEW_GUILD_ID, PASTA_MINT } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "devfridge-world-creator",
    guild: DISCORD_REVIEW_GUILD_ID,
    channel: DISCORD_CREATOR_CHANNEL_ID,
    discordAppConfigured: Boolean(DISCORD_APPLICATION_ID),
    pastaMint: PASTA_MINT,
  });
}
