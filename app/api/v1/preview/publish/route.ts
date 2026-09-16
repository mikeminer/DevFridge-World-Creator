import { NextResponse } from "next/server";
import { SESSION_SECRET } from "@/lib/config";
import { putGlb, savePreviewRecord } from "@/lib/preview/catalog";
import type { PreviewRecord } from "@/lib/preview/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!SESSION_SECRET || auth !== `Bearer ${SESSION_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as PreviewRecord & { glbBase64?: string };
  if (!body.id || !body.publicId || !body.glbBase64) {
    return NextResponse.json({ error: "id, publicId, glbBase64 required" }, { status: 400 });
  }
  const glb = Buffer.from(body.glbBase64, "base64");
  const glbUrl = await putGlb(body.id, body.version || 1, glb);
  const record: PreviewRecord = {
    id: body.id,
    publicId: body.publicId,
    name: body.name,
    projectName: body.projectName,
    status: body.status,
    version: body.version || 1,
    fileBytes: glb.length,
    sha256: body.sha256,
    glbUrl,
    thumbnailUrl: body.thumbnailUrl || null,
    publishedAt: new Date().toISOString(),
  };
  await savePreviewRecord(record);
  return NextResponse.json(record);
}
