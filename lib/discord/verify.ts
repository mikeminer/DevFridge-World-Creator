import nacl from "tweetnacl";
import { DISCORD_PUBLIC_KEY } from "../config";

export function normalizePublicKey(value: string): string {
  return value.trim().replace(/^0x/i, "");
}

export function verifyDiscordRequest(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKey = DISCORD_PUBLIC_KEY
): { ok: true } | { ok: false; error: string } {
  const keyHex = normalizePublicKey(publicKey || "");
  const sigHex = (signature || "").trim();
  const ts = (timestamp || "").trim();
  if (!sigHex || !ts || !keyHex) {
    return { ok: false, error: "missing signature, timestamp, or public key" };
  }
  try {
    const msg = Buffer.from(ts + body);
    const sig = Buffer.from(sigHex, "hex");
    const key = Buffer.from(keyHex, "hex");
    if (sig.length !== 64 || key.length !== 32) {
      return { ok: false, error: "malformed signature" };
    }
    const ok = nacl.sign.detached.verify(new Uint8Array(msg), new Uint8Array(sig), new Uint8Array(key));
    return ok ? { ok: true } : { ok: false, error: "invalid signature" };
  } catch {
    return { ok: false, error: "signature verification failed" };
  }
}
