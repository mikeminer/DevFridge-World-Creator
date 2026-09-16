import { NextResponse } from "next/server";
import { SOLANA_RPC_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(SOLANA_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
