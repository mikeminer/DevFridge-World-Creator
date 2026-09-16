import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { CREATOR_BASE_URL } from "../config";
import { sha256Hex, uuid } from "../ids";
import { appendAudit, withStore } from "../store";

export async function issueNonce(discordUserId: string, userId: string) {
  const nonce = uuid();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);
  const domain = new URL(CREATOR_BASE_URL).host;
  const message = [
    "DevFridge World Creator Authentication",
    "",
    `Discord User: ${discordUserId}`,
    `Nonce: ${nonce}`,
    `Domain: ${domain}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
    "",
    "This signature does not execute a transaction.",
  ].join("\n");
  await withStore((db) => {
    db.nonces.push({
      id: uuid(),
      userId,
      discordUserId,
      nonce,
      domain,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
    });
  });
  return { nonce, message, expiresAt: expiresAt.toISOString() };
}

export async function verifyWalletSignature(input: {
  discordUserId: string;
  wallet: string;
  nonce: string;
  signatureBase58: string;
  message: string;
}): Promise<{ ok: true; wallet: string } | { ok: false; error: string }> {
  const row = await withStore((db) =>
    db.nonces.find((n) => n.nonce === input.nonce && n.discordUserId === input.discordUserId)
  );
  if (!row) return { ok: false, error: "unknown nonce" };
  if (row.usedAt) return { ok: false, error: "nonce already used" };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false, error: "nonce expired" };
  if (!input.message.includes(row.nonce) || !input.message.includes(row.domain)) {
    return { ok: false, error: "message does not match nonce/domain" };
  }
  try {
    const pubkey = new PublicKey(input.wallet);
    const sig = bs58.decode(input.signatureBase58);
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(input.message),
      sig,
      pubkey.toBytes()
    );
    if (!ok) return { ok: false, error: "invalid signature" };
  } catch {
    return { ok: false, error: "signature verification failed" };
  }
  await withStore((db) => {
    const n = db.nonces.find((x) => x.nonce === input.nonce);
    if (n) n.usedAt = new Date().toISOString();
    const user = db.users.find((u) => u.discordUserId === input.discordUserId);
    if (user) {
      db.walletLinks.forEach((w) => {
        if (w.userId === user.id && !w.revokedAt) w.revokedAt = new Date().toISOString();
      });
      db.walletLinks.push({
        id: uuid(),
        userId: user.id,
        walletAddress: input.wallet,
        verifiedAt: new Date().toISOString(),
        revokedAt: null,
        verificationNonceHash: sha256Hex(input.nonce),
      });
      appendAudit(db, {
        actor: `discord:${input.discordUserId}`,
        entityType: "wallet",
        entityId: input.wallet,
        eventType: "WALLET_LINKED",
        metadata: {},
      });
    }
  });
  return { ok: true, wallet: input.wallet };
}
