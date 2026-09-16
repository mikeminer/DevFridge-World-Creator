import type { EligibilityContext } from "./types";

/**
 * Single source of truth: no asset is active in World unless every gate is true.
 * Do not reimplement this in Discord, the web UI, or the game client.
 */
export function isWorldAssetEligible(ctx: EligibilityContext): boolean {
  return (
    ctx.creatorConfirmed &&
    ctx.rightsAttested &&
    ctx.assetValidated &&
    ctx.publicationApproved &&
    ctx.commitmentFinalized &&
    ctx.commitmentMeetsQuote &&
    ctx.now >= ctx.activeFrom &&
    ctx.now < ctx.activeUntil &&
    !ctx.optedOut &&
    !ctx.suspended &&
    !ctx.removed
  );
}

export function missingEligibilityReasons(ctx: EligibilityContext): string[] {
  const missing: string[] = [];
  if (!ctx.creatorConfirmed) missing.push("creator has not confirmed the generated asset");
  if (!ctx.rightsAttested) missing.push("rights declaration is missing");
  if (!ctx.assetValidated) missing.push("asset failed technical validation");
  if (!ctx.publicationApproved) missing.push("DevFridge has not approved publication");
  if (!ctx.commitmentFinalized) missing.push("on-chain $PASTA commitment is not finalized");
  if (!ctx.commitmentMeetsQuote) missing.push("commitment does not meet the issued quote");
  if (ctx.now < ctx.activeFrom) missing.push("eligibility window has not started");
  if (ctx.now >= ctx.activeUntil) missing.push("eligibility window has ended");
  if (ctx.optedOut) missing.push("creator opted the asset out of World");
  if (ctx.suspended) missing.push("asset is suspended");
  if (ctx.removed) missing.push("asset was removed");
  return missing;
}
