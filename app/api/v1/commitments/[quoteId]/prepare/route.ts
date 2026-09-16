import { NextResponse } from "next/server";
import { prepareCommitment } from "@/lib/solana/commitments";
import { verifyPreviewToken } from "@/lib/ids";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: { quoteId: string } }) {
  const body = (await req.json()) as { wallet?: string; token?: string; submissionId?: string };
  if (!body.wallet || !body.submissionId || !verifyPreviewToken(body.token || "", body.submissionId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const quote = await readStore((db) => db.commitmentQuotes.find((q) => q.id === ctx.params.quoteId));
  if (!quote || quote.submissionId !== body.submissionId) {
    return NextResponse.json({ error: "quote mismatch" }, { status: 400 });
  }
  try {
    const prepared = await prepareCommitment(ctx.params.quoteId, body.wallet);
    return NextResponse.json(prepared);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
