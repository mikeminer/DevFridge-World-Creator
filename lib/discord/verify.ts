import nacl from "tweetnacl";
import { DISCORD_PUBLIC_KEY } from "../config";

const MAX_AGE_MS = 5 * 60 * 1000;

export function verifyDiscordRequest(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKey = DISCORD_PUBLIC_KEY
): { ok: true } | { ok: false; error: string } {
  if (!signature || !timestamp || !publicKey) {
    return { ok: false, error: "missing signature, timestamp, or public key" };
  }
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) {
    return { ok: false, error: "stale timestamp" };
  }
  try {
    const msg = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(publicKey, "hex");
    if (sig.length !== 64 || key.length !== 32) {
      return { ok: false, error: "malformed signature" };
    }
    const ok = nacl.sign.detached.verify(new Uint8Array(msg), new Uint8Array(sig), new Uint8Array(key));
    return ok ? { ok: true } : { ok: false, error: "invalid signature" };
  } catch {
    return { ok: false, error: "signature verification failed" };
  }
}
