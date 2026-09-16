"use client";

import { useState } from "react";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { COMMITMENT_COPY } from "@/lib/copy";
import { baseUnitsToPasta } from "@/lib/config";

type Quote = {
  id: string;
  mint: string;
  requiredAmount: string;
  requiredDurationSeconds: number;
  expiresAt: string;
  status: string;
};

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toBase58(): string };
      connect: () => Promise<{ publicKey: { toBase58(): string } }>;
      signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    };
  }
}

export function CommitClient({
  submissionId,
  token,
  quote,
}: {
  submissionId: string;
  token: string;
  quote: Quote;
}) {
  const [log, setLog] = useState("Connect Phantom, sign in, then commit $PASTA.");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const provider = window.solana;
      if (!provider?.isPhantom) throw new Error("Phantom not found. Open this page in a wallet browser.");
      const connected = await provider.connect();
      const wallet = connected.publicKey.toBase58();
      const nonceRes = await fetch("/api/v1/wallet/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId, token }),
      });
      const nonce = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonce.error || "nonce failed");
      const encoded = new TextEncoder().encode(nonce.message);
      const signed = await provider.signMessage(encoded, "utf8");
      const bs58 = (await import("bs58")).default;
      const verify = await fetch("/api/v1/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId,
          token,
          wallet,
          nonce: nonce.nonce,
          message: nonce.message,
          signature: bs58.encode(signed.signature),
        }),
      });
      const verified = await verify.json();
      if (!verify.ok) throw new Error(verified.error || "wallet verify failed");
      const prepRes = await fetch(`/api/v1/commitments/${quote.id}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, token, submissionId }),
      });
      const prepared = await prepRes.json();
      if (!prepRes.ok) throw new Error(prepared.error || "prepare failed");
      const ix = new TransactionInstruction({
        programId: new PublicKey(prepared.instruction.programId),
        keys: prepared.instruction.keys.map((k: { pubkey: string; isSigner: boolean; isWritable: boolean }) => ({
          pubkey: new PublicKey(k.pubkey),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        data: Buffer.from(prepared.instruction.data, "base64"),
      });
      const connection = new Connection("/api/rpc", "confirmed");
      const tx = new Transaction().add(ix);
      tx.feePayer = new PublicKey(wallet);
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signedTx = await provider.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      setLog(`Submitted ${sig}. Waiting for finalized Fridge lock…`);
      await connection.confirmTransaction(sig, "finalized");
      const done = await fetch("/api/v1/commitments/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          wallet,
          txSignature: sig,
          lockAddress: prepared.lockAddress,
          token,
          submissionId,
        }),
      });
      const result = await done.json();
      if (!done.ok || !result.ok) throw new Error(result.error || "on-chain verification failed");
      setLog("Commitment finalized. Asset is eligible for the verified window.");
    } catch (err) {
      setLog(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        Required commitment: <b>{baseUnitsToPasta(quote.requiredAmount)} $PASTA</b> for{" "}
        {Math.round(quote.requiredDurationSeconds / 86400)} days.
      </p>
      <p className="muted">{COMMITMENT_COPY}</p>
      <p className="muted">Mint <code>{quote.mint}</code></p>
      <div className="row">
        <button className="btn sauce" disabled={busy} onClick={() => void run()}>
          {busy ? "Working…" : "Connect wallet and commit"}
        </button>
      </div>
      <p className="status">{log}</p>
    </div>
  );
}
