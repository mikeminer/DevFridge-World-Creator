import { fileUrl } from "../ids";
import { isWorldAssetEligible } from "../eligibility";
import { readStore, withStore } from "../store";
import type { EligibilityContext, WorldManifest } from "../types";

export async function buildManifest(): Promise<WorldManifest> {
  expireIfNeeded();
  return readStore((db) => {
    const now = Date.now();
    const assets = db.worldAssets
      .map((asset) => {
        const sub = db.submissions.find((s) => s.id === asset.submissionId);
        const version = db.assetVersions.find((v) => v.id === asset.assetVersionId);
        const commitment = db.commitments.find((c) => c.id === asset.commitmentId);
        const rights = db.rightsAttestations.some(
          (r) => r.submissionId === asset.submissionId && r.stage === "publication"
        );
        const approved = db.moderationDecisions.some(
          (d) => d.submissionId === asset.submissionId && d.decision === "APPROVED"
        );
        if (!sub || !version || !commitment) return null;
        const ctx: EligibilityContext = {
          creatorConfirmed: Boolean(version.confirmedAt),
          rightsAttested: rights,
          assetValidated: version.validationStatus === "PASSED",
          publicationApproved: approved,
          commitmentFinalized: commitment.finalized,
          commitmentMeetsQuote: BigInt(commitment.amount) >= 0n,
          now,
          activeFrom: new Date(asset.activeFrom).getTime(),
          activeUntil: new Date(asset.activeUntil).getTime(),
          optedOut: Boolean(asset.optedOutAt) || asset.status === "OPTED_OUT",
          suspended: Boolean(asset.suspendedAt) || asset.status === "SUSPENDED",
          removed: asset.status === "REMOVED",
        };
        if (!isWorldAssetEligible(ctx)) return null;
        return {
          asset_id: asset.publicId,
          version: version.version,
          name: sub.name,
          glb_url: fileUrl(version.finalGlbKey),
          sha256: version.finalGlbSha256,
          thumbnail_url: fileUrl(version.thumbnailKey),
          active_from: asset.activeFrom,
          active_until: asset.activeUntil,
          creator: { display_name: "Community Creator" },
          community: { name: sub.projectName, mint: sub.tokenMint },
          runtime: { scale: 1, ground_offset: 0, collider: "capsule", lod: false },
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      version: db.manifestVersion,
      generated_at: new Date().toISOString(),
      season: "next",
      assets,
    };
  });
}

export async function expireIfNeeded(): Promise<void> {
  await withStore((db) => {
    const now = Date.now();
    for (const asset of db.worldAssets) {
      if (asset.status === "ACTIVE" && new Date(asset.activeUntil).getTime() <= now) {
        asset.status = "EXPIRED";
        const sub = db.submissions.find((s) => s.id === asset.submissionId);
        if (sub && sub.status === "ACTIVE") {
          sub.status = "EXPIRED";
          sub.updatedAt = new Date().toISOString();
        }
        db.manifestVersion += 1;
      }
    }
  });
}
