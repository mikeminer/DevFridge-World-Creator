import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWorldAssetEligible, missingEligibilityReasons } from "../lib/eligibility";
import type { EligibilityContext } from "../lib/types";

function base(over: Partial<EligibilityContext> = {}): EligibilityContext {
  const now = 1_000_000;
  return {
    creatorConfirmed: true,
    rightsAttested: true,
    assetValidated: true,
    publicationApproved: true,
    commitmentFinalized: true,
    commitmentMeetsQuote: true,
    now,
    activeFrom: now - 10,
    activeUntil: now + 10,
    optedOut: false,
    suspended: false,
    removed: false,
    ...over,
  };
}

describe("isWorldAssetEligible", () => {
  it("passes only when every gate is true", () => {
    assert.equal(isWorldAssetEligible(base()), true);
  });

  it("fails without a finalized commitment", () => {
    const ctx = base({ commitmentFinalized: false });
    assert.equal(isWorldAssetEligible(ctx), false);
    assert.ok(missingEligibilityReasons(ctx).some((r) => r.includes("commitment")));
  });

  it("fails after opt-out even with a live lock", () => {
    assert.equal(isWorldAssetEligible(base({ optedOut: true })), false);
  });

  it("fails outside the window", () => {
    assert.equal(isWorldAssetEligible(base({ now: 50, activeFrom: 100, activeUntil: 200 })), false);
    assert.equal(isWorldAssetEligible(base({ now: 250, activeFrom: 100, activeUntil: 200 })), false);
  });
});
