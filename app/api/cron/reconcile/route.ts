import { NextResponse } from "next/server";
import { CRON_SECRET } from "@/lib/config";
import { expireIfNeeded } from "@/lib/world/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await expireIfNeeded();
  return NextResponse.json({ ok: true });
}
