import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PASTA_MINT } from "../lib/config";
import { commitmentMeetsQuote, estimatedClaim, quoteForDuration } from "../lib/quotes";

describe("quotes", () => {
  it("uses configurable PASTA amounts and the canonical mint", () => {
    const q = quoteForDuration("30d");
    assert.equal(q.mint, PASTA_MINT);
    assert.equal(q.durationSeconds, 30 * 86400);
    assert.ok(BigInt(q.amountBaseUnits) > 0n);
  });

  it("rejects a shorter or smaller lock", () => {
    const q = quoteForDuration("7d");
    const now = Date.now();
    assert.equal(
      commitmentMeetsQuote({
        mint: q.mint,
        amount: (BigInt(q.amountBaseUnits) - 1n).toString(),
        unlockAtMs: now + q.durationSeconds * 1000,
        quoteMint: q.mint,
        quoteAmount: q.amountBaseUnits,
        quoteUnlockAtMs: now + q.durationSeconds * 1000,
      }),
      false
    );
  });

  it("labels 2% burn as an estimate", () => {
    const e = estimatedClaim("100000000");
    assert.equal(e.estimatedBurn, "2000000");
    assert.ok(e.note.includes("Estimates only"));
  });
});
