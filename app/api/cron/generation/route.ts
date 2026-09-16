import { NextResponse } from "next/server";
import { CRON_SECRET } from "@/lib/config";
import { processQueuedJobs } from "@/lib/generation/run";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const processed = await processQueuedJobs();
  return NextResponse.json({ ok: true, processed });
}
