import { NextResponse } from "next/server";
import { verifyAndActivate } from "@/lib/solana/commitments";
import { verifyPreviewToken } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    quoteId?: string;
    wallet?: string;
    txSignature?: string;
    lockAddress?: string;
    token?: string;
    submissionId?: string;
  };
  if (!body.submissionId || !verifyPreviewToken(body.token || "", body.submissionId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await verifyAndActivate({
    quoteId: body.quoteId || "",
    wallet: body.wallet || "",
    txSignature: body.txSignature || "",
    lockAddress: body.lockAddress || "",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
