import { NextResponse } from "next/server";
import { verifyPreviewToken } from "@/lib/ids";
import { findSub, latestVersion } from "@/lib/sdk";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  try {
    const data = await readStore((db) => {
      const sub = findSub(db.submissions, ctx.params.id);
      const version = latestVersion(db.assetVersions, sub.id) || null;
      const quote = db.commitmentQuotes.filter((q) => q.submissionId === sub.id).at(-1) || null;
      const commitment = db.commitments.filter((c) => c.submissionId === sub.id).at(-1) || null;
      const sources = db.sourceFiles.filter((f) => f.submissionId === sub.id);
      return { sub, version, quote, commitment, sources };
    });
    if (data.sub.status !== "ACTIVE" && !verifyPreviewToken(token, data.sub.id)) {
      return NextResponse.json({ error: "unauthorized preview" }, { status: 401 });
    }
    return NextResponse.json({
      id: data.sub.id,
      publicId: data.sub.publicId,
      name: data.sub.name,
      projectName: data.sub.projectName,
      description: data.sub.description,
      status: data.sub.status,
      duration: data.sub.requestedDurationKey,
      tokenMint: data.sub.tokenMint,
      version: data.version,
      quote: data.quote
        ? {
            id: data.quote.id,
            mint: data.quote.mint,
            requiredAmount: data.quote.requiredAmount,
            requiredDurationSeconds: data.quote.requiredDurationSeconds,
            expiresAt: data.quote.expiresAt,
            status: data.quote.status,
          }
        : null,
      commitment: data.commitment
        ? {
            status: data.commitment.status,
            unlockAt: data.commitment.unlockAt,
            finalized: data.commitment.finalized,
          }
        : null,
      sourceCount: data.sources.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 404 });
  }
}
