import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { PASTA_MINT, PROGRAM_ID, SOLANA_RPC_URL } from "../config";
import { uuid } from "../ids";
import { commitmentMeetsQuote } from "../quotes";
import { notifyActivated } from "../discord/notify";
import { appendAudit, withStore } from "../store";
import { assertTransition } from "../state";
import { CREATE_LOCK_DISCRIMINATOR, LOCK_ACCOUNT_DISCRIMINATOR, LOCK_SEED, PASTA, PROGRAM } from "./constants";

function u64le(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, true);
  return buf;
}

export function lockPda(depositor: PublicKey, mint: PublicKey, lockId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(LOCK_SEED), depositor.toBuffer(), mint.toBuffer(), u64le(lockId)],
    PROGRAM
  );
}

export function vaultAddress(mint: PublicKey, lock: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, lock, true, TOKEN_2022_PROGRAM_ID);
}

export function buildCreateLockIx(args: {
  depositor: PublicKey;
  amount: bigint;
  unlockAt: bigint;
  lockId: bigint;
}): TransactionInstruction {
  const [lock] = lockPda(args.depositor, PASTA, args.lockId);
  const vault = vaultAddress(PASTA, lock);
  const depositorAta = getAssociatedTokenAddressSync(PASTA, args.depositor, false, TOKEN_2022_PROGRAM_ID);
  const data = new Uint8Array(8 + 8 + 8 + 8);
  data.set(CREATE_LOCK_DISCRIMINATOR, 0);
  data.set(u64le(args.amount), 8);
  data.set(u64le(args.unlockAt), 16);
  data.set(u64le(args.lockId), 24);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: args.depositor, isSigner: true, isWritable: true },
      { pubkey: PASTA, isSigner: false, isWritable: false },
      { pubkey: depositorAta, isSigner: false, isWritable: true },
      { pubkey: lock, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export function decodeLock(address: string, data: Uint8Array) {
  if (data.length < 105) return null;
  for (let i = 0; i < 8; i++) if (data[i] !== LOCK_ACCOUNT_DISCRIMINATOR[i]) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    address,
    depositor: new PublicKey(data.slice(8, 40)).toBase58(),
    mint: new PublicKey(data.slice(40, 72)).toBase58(),
    amount: view.getBigUint64(72, true).toString(),
    createdAt: Number(view.getBigUint64(80, true)),
    unlockAt: Number(view.getBigUint64(88, true)),
    bump: data[96],
    lockId: view.getBigUint64(97, true).toString(),
  };
}

export function connection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export async function prepareCommitment(quoteId: string, wallet: string) {
  const quote = await withStore((db) => {
    const q = db.commitmentQuotes.find((x) => x.id === quoteId);
    if (!q || q.status !== "OPEN") throw new Error("quote is not open");
    if (new Date(q.expiresAt).getTime() < Date.now()) throw new Error("quote expired");
    q.walletAddress = wallet;
    const sub = db.submissions.find((s) => s.id === q.submissionId);
    if (!sub) throw new Error("submission missing");
    if (sub.status === "QUOTE_ISSUED") {
      assertTransition(sub.status, "COMMITMENT_PENDING");
      sub.status = "COMMITMENT_PENDING";
      sub.updatedAt = new Date().toISOString();
    }
    return q;
  });
  const depositor = new PublicKey(wallet);
  const lockId = BigInt(Date.now());
  const unlockAt = BigInt(Math.floor(Date.now() / 1000) + quote.requiredDurationSeconds);
  const amount = BigInt(quote.requiredAmount);
  const [lock] = lockPda(depositor, PASTA, lockId);
  const vault = vaultAddress(PASTA, lock);
  const ix = buildCreateLockIx({ depositor, amount, unlockAt, lockId });
  return {
    quoteId: quote.id,
    programId: PROGRAM_ID,
    mint: PASTA_MINT,
    amount: quote.requiredAmount,
    unlockAt: Number(unlockAt),
    lockId: lockId.toString(),
    lockAddress: lock.toBase58(),
    vaultAddress: vault.toBase58(),
    instruction: {
      programId: ix.programId.toBase58(),
      keys: ix.keys.map((k) => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })),
      data: Buffer.from(ix.data).toString("base64"),
    },
  };
}

export async function verifyAndActivate(input: {
  quoteId: string;
  wallet: string;
  txSignature: string;
  lockAddress: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const conn = connection();
  const info = await conn.getAccountInfo(new PublicKey(input.lockAddress), "finalized");
  if (!info) return { ok: false, error: "lock account not found (wait for finalization)" };
  const lock = decodeLock(input.lockAddress, info.data);
  if (!lock) return { ok: false, error: "not a Fridge lock account" };

  const quote = await withStore((db) => db.commitmentQuotes.find((q) => q.id === input.quoteId));
  if (!quote) return { ok: false, error: "quote missing" };

  const minUnlock = Math.floor(Date.now() / 1000) + quote.requiredDurationSeconds - 120;
  const meets = commitmentMeetsQuote({
    mint: lock.mint,
    amount: lock.amount,
    unlockAtMs: lock.unlockAt * 1000,
    quoteMint: quote.mint,
    quoteAmount: quote.requiredAmount,
    quoteUnlockAtMs: minUnlock * 1000,
  });
  if (lock.depositor !== input.wallet) return { ok: false, error: "wallet does not match lock depositor" };
  if (!meets) return { ok: false, error: "on-chain lock does not meet the issued quote" };

  await withStore((db) => {
    const q = db.commitmentQuotes.find((x) => x.id === input.quoteId);
    const sub = q ? db.submissions.find((s) => s.id === q.submissionId) : null;
    if (!q || !sub) return;
    q.status = "ACCEPTED";
    q.walletAddress = input.wallet;
    const now = new Date().toISOString();
    const commitmentId = uuid();
    db.commitments.push({
      id: commitmentId,
      quoteId: q.id,
      submissionId: sub.id,
      walletAddress: input.wallet,
      mint: lock.mint,
      programId: PROGRAM_ID,
      vaultAddress: vaultAddress(new PublicKey(lock.mint), new PublicKey(lock.address)).toBase58(),
      amount: lock.amount,
      createdAtChain: new Date(lock.createdAt * 1000).toISOString(),
      unlockAt: new Date(lock.unlockAt * 1000).toISOString(),
      txSignature: input.txSignature,
      confirmedSlot: null,
      finalized: true,
      claimedAt: null,
      claimTxSignature: null,
      burnAmount: null,
      status: "LOCK_CONFIRMED",
      lastVerifiedAt: now,
    });
    const version = db.assetVersions.filter((v) => v.submissionId === sub.id).sort((a, b) => b.version - a.version)[0];
    const approved = db.moderationDecisions.some((d) => d.submissionId === sub.id && d.decision === "APPROVED");
    if (version && approved) {
      sub.status = "ACTIVE";
      sub.updatedAt = now;
      db.worldAssets.push({
        id: uuid(),
        submissionId: sub.id,
        assetVersionId: version.id,
        commitmentId,
        publicId: sub.publicId,
        status: "ACTIVE",
        activeFrom: now,
        activeUntil: new Date(lock.unlockAt * 1000).toISOString(),
        optedOutAt: null,
        suspendedAt: null,
        removalReason: null,
        manifestVersion: ++db.manifestVersion,
      });
      appendAudit(db, {
        actor: `wallet:${input.wallet}`,
        entityType: "world_asset",
        entityId: sub.id,
        eventType: "ASSET_ACTIVATED",
        metadata: { tx: input.txSignature, unlockAt: lock.unlockAt },
      });
    }
  });
  await notifyActivated(
    (await withStore((db) => db.commitmentQuotes.find((q) => q.id === input.quoteId)?.submissionId)) || ""
  );
  return { ok: true };
}
