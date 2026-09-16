import { NextResponse } from "next/server";
import { handleInteraction } from "@/lib/discord/handlers";
import { verifyDiscordRequest } from "@/lib/discord/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const verified = verifyDiscordRequest(body, signature, timestamp);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }
  try {
    const interaction = JSON.parse(body);
    const payload = await handleInteraction(interaction);
    return NextResponse.json(payload);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        type: 4,
        data: {
          flags: 64,
          content: err instanceof Error ? err.message : "World Creator error",
        },
      },
      { status: 200 }
    );
  }
}
