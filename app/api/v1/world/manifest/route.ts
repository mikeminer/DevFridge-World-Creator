import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/world/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = await buildManifest();
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
