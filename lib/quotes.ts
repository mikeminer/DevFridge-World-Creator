import { PASTA_MINT, QUOTE_PASTA, QUOTE_TTL_HOURS, pastaToBaseUnits } from "./config";

export function quoteForDuration(durationKey: string): {
  durationKey: string;
  pastaWhole: number;
  amountBaseUnits: string;
  durationSeconds: number;
  ttlHours: number;
  mint: string;
  policyVersion: string;
} {
  const pastaWhole = QUOTE_PASTA[durationKey];
  if (pastaWhole == null) throw new Error(`Unknown duration ${durationKey}`);
  const durationSeconds =
    durationKey === "7d" ? 7 * 86400 : durationKey === "90d" ? 90 * 86400 : 30 * 86400;
  return {
    durationKey,
    pastaWhole,
    amountBaseUnits: pastaToBaseUnits(pastaWhole).toString(),
    durationSeconds,
    ttlHours: QUOTE_TTL_HOURS,
    mint: PASTA_MINT,
    policyVersion: "creator-v1",
  };
}

export function commitmentMeetsQuote(input: {
  mint: string;
  amount: string;
  unlockAtMs: number;
  quoteMint: string;
  quoteAmount: string;
  quoteUnlockAtMs: number;
}): boolean {
  if (input.mint !== input.quoteMint) return false;
  if (BigInt(input.amount) < BigInt(input.quoteAmount)) return false;
  if (input.unlockAtMs < input.quoteUnlockAtMs) return false;
  return true;
}

export function estimatedClaim(amountBaseUnits: string): {
  estimatedBurn: string;
  estimatedReturn: string;
  note: string;
} {
  const amount = BigInt(amountBaseUnits);
  const burn = (amount * 200n) / 10_000n;
  return {
    estimatedBurn: burn.toString(),
    estimatedReturn: (amount - burn).toString(),
    note: "Estimates only. The exact result comes from the DevFridge program and token-account balances.",
  };
}
