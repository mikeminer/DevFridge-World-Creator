import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { storagePath } from "@/lib/ingest/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  glb: "model/gltf-binary",
};

export async function GET(_req: Request, ctx: { params: { key: string[] } }) {
  const key = ctx.params.key.join("/");
  if (key.includes("..")) return NextResponse.json({ error: "bad key" }, { status: 400 });
  try {
    const buf = await readFile(storagePath(key));
    const ext = key.split(".").pop() || "";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
