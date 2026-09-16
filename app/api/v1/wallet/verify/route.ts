import { NextResponse } from "next/server";
import { verifyWalletSignature } from "@/lib/solana/auth";
import { findSub } from "@/lib/sdk";
import { readStore } from "@/lib/store";
import { verifyPreviewToken } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    submissionId?: string;
    token?: string;
    wallet?: string;
    nonce?: string;
    signature?: string;
    message?: string;
  };
  if (!body.submissionId || !verifyPreviewToken(body.token || "", body.submissionId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sub = await readStore((db) => findSub(db.submissions, body.submissionId!));
  const result = await verifyWalletSignature({
    discordUserId: sub.discordUserId,
    wallet: body.wallet || "",
    nonce: body.nonce || "",
    signatureBase58: body.signature || "",
    message: body.message || "",
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
