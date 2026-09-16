import { NextResponse } from "next/server";
import { loadPreviewRecord } from "@/lib/preview/catalog";
import { fileUrl, verifyPreviewToken } from "@/lib/ids";
import { findSub, latestVersion } from "@/lib/sdk";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const fromCatalog = await loadPreviewRecord(ctx.params.id);
  if (fromCatalog) {
    if (!verifyPreviewToken(token, fromCatalog.id) && fromCatalog.status !== "ACTIVE") {
      return NextResponse.json({ error: "unauthorized preview" }, { status: 401 });
    }
    return NextResponse.json(fromCatalog);
  }
  try {
    const data = await readStore((db) => {
      const sub = findSub(db.submissions, ctx.params.id);
      const version = latestVersion(db.assetVersions, sub.id);
      return { sub, version };
    });
    if (data.sub.status !== "ACTIVE" && !verifyPreviewToken(token, data.sub.id)) {
      return NextResponse.json({ error: "unauthorized preview" }, { status: 401 });
    }
    if (!data.version) return NextResponse.json({ error: "not generated" }, { status: 404 });
    return NextResponse.json({
      id: data.sub.id,
      publicId: data.sub.publicId,
      name: data.sub.name,
      projectName: data.sub.projectName,
      status: data.sub.status,
      version: data.version.version,
      fileBytes: data.version.fileBytes,
      sha256: data.version.finalGlbSha256,
      glbUrl: data.version.finalGlbKey.startsWith("http")
        ? data.version.finalGlbKey
        : fileUrl(data.version.finalGlbKey),
      thumbnailUrl: data.version.thumbnailKey ? fileUrl(data.version.thumbnailKey) : null,
      publishedAt: data.version.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
