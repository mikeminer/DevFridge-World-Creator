import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/solana/auth";
import { findSub } from "@/lib/sdk";
import { readStore } from "@/lib/store";
import { verifyPreviewToken } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { submissionId?: string; token?: string };
  if (!body.submissionId || !verifyPreviewToken(body.token || "", body.submissionId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sub = await readStore((db) => findSub(db.submissions, body.submissionId!));
  const issued = await issueNonce(sub.discordUserId, sub.creatorUserId);
  return NextResponse.json(issued);
}
