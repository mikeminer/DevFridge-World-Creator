import {
  CREATOR_BASE_URL,
  DURATION_SECONDS,
  GENERATION_MAX_ATTEMPTS,
  IMAGE_MAX_COUNT,
  PASTA_MINT,
  PROGRAM_ID,
  QUOTE_TTL_HOURS,
  RIGHTS_POLICY_VERSION,
} from "./config";
import { GENERATION_RIGHTS_STATEMENT, PUBLICATION_RIGHTS_STATEMENT } from "./copy";
import { queueGeneration } from "./generation/run";
import { commitUrl, fileUrl, previewUrl, sha256Hex, uuid } from "./ids";
import { downloadUrl, saveBuffer, validateImage } from "./ingest/images";
import { quoteForDuration } from "./quotes";
import { appendAudit, nextPublicId, upsertUser, withStore } from "./store";
import { assertTransition } from "./state";
import type {
  AssetVersion,
  CommitmentQuote,
  ReportCategory,
  Submission,
  WorldAsset,
} from "./types";

export type AttachmentIn = { id: string; filename: string; url: string; size: number };

export async function createSubmission(input: {
  discordUserId: string;
  discordUsername: string;
  discordChannelId: string;
  discordGuildId: string;
  discordInteractionId?: string;
  name: string;
  projectName: string;
  description: string;
  durationKey: string;
  tokenMint?: string | null;
  website?: string | null;
  xAccount?: string | null;
  notes?: string | null;
  attachments: AttachmentIn[];
}): Promise<Submission> {
  if (!input.attachments.length) throw new Error("at least one source image is required");
  if (input.attachments.length > IMAGE_MAX_COUNT) {
    throw new Error(`at most ${IMAGE_MAX_COUNT} images`);
  }
  const durationSeconds = DURATION_SECONDS[input.durationKey];
  if (!durationSeconds) throw new Error("duration must be 7d, 30d, or 90d");

  const saved: { filename: string; mime: string; bytes: number; sha: string; key: string; attachmentId: string }[] =
    [];
  for (let i = 0; i < input.attachments.length; i++) {
    const att = input.attachments[i];
    const buf = await downloadUrl(att.url);
    const check = validateImage(buf);
    if (!check.ok) throw new Error(`${att.filename}: ${check.error}`);
    const sha = sha256Hex(buf);
    const ext = check.mime === "image/png" ? "png" : check.mime === "image/webp" ? "webp" : "jpg";
    const tempKey = `tmp/${uuid()}.${ext}`;
    await saveBuffer(tempKey, buf);
    saved.push({
      filename: att.filename,
      mime: check.mime,
      bytes: buf.length,
      sha,
      key: tempKey,
      attachmentId: att.id,
    });
  }

  const sub = await withStore((db) => {
    const user = upsertUser(db, input.discordUserId, input.discordUsername);
    const id = uuid();
    const publicId = nextPublicId(db);
    const now = new Date().toISOString();
    const submission: Submission = {
      id,
      publicId,
      creatorUserId: user.id,
      discordUserId: input.discordUserId,
      discordChannelId: input.discordChannelId,
      discordGuildId: input.discordGuildId,
      name: input.name.trim(),
      projectName: input.projectName.trim(),
      description: input.description.trim(),
      tokenMint: input.tokenMint?.trim() || null,
      website: input.website?.trim() || null,
      xAccount: input.xAccount?.trim() || null,
      notes: input.notes?.trim() || null,
      requestedDurationKey: input.durationKey,
      requestedDurationSeconds: durationSeconds,
      status: "SOURCE_RECEIVED",
      createdAt: now,
      updatedAt: now,
    };
    db.submissions.push(submission);
    saved.forEach((file, i) => {
      const key = `sources/${id}/source_${String(i + 1).padStart(2, "0")}.${file.filename.split(".").pop()}`;
      db.sourceFiles.push({
        id: uuid(),
        submissionId: id,
        originalFilename: file.filename,
        mimeType: file.mime,
        bytes: file.bytes,
        sha256: file.sha,
        storageKey: file.key,
        uploadedAt: now,
        discordAttachmentId: file.attachmentId,
        moderationStatus: "PASSED",
      });
      // keep temp key; fileUrl still works. Rewrite key for stable path on next saveBuffer if needed.
      db.sourceFiles[db.sourceFiles.length - 1].storageKey = file.key;
    });
    appendAudit(db, {
      actor: `discord:${input.discordUserId}`,
      entityType: "submission",
      entityId: id,
      eventType: "SUBMISSION_CREATED",
      metadata: { publicId, sources: saved.length },
    });
    return submission;
  });
  return sub;
}

export async function acceptRights(
  submissionId: string,
  actorDiscordUserId: string,
  interactionId: string | null,
  stage: "generation" | "publication"
): Promise<Submission> {
  const statement = stage === "generation" ? GENERATION_RIGHTS_STATEMENT : PUBLICATION_RIGHTS_STATEMENT;
  return withStore((db) => {
    const sub = db.submissions.find((s) => s.id === submissionId || s.publicId === submissionId);
    if (!sub) throw new Error("submission not found");
    if (sub.discordUserId !== actorDiscordUserId) throw new Error("only the creator can attest rights");
    const user = db.users.find((u) => u.id === sub.creatorUserId);
    if (!user) throw new Error("user missing");
    if (stage === "generation") {
      assertTransition(sub.status, "RIGHTS_ATTESTED");
      sub.status = "RIGHTS_ATTESTED";
    }
    db.rightsAttestations.push({
      id: uuid(),
      submissionId: sub.id,
      userId: user.id,
      walletAddress: null,
      attestationVersion: RIGHTS_POLICY_VERSION,
      statementHash: sha256Hex(statement),
      statement,
      acceptedAt: new Date().toISOString(),
      discordInteractionId: interactionId,
      stage,
    });
    sub.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: `discord:${actorDiscordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "RIGHTS_ACCEPTED",
      metadata: { stage, version: RIGHTS_POLICY_VERSION },
    });
    return sub;
  });
}

export async function startGeneration(submissionId: string): Promise<void> {
  await queueGeneration(submissionId);
}

export async function confirmAsset(submissionId: string, actorDiscordUserId: string): Promise<Submission> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    if (sub.discordUserId !== actorDiscordUserId) throw new Error("only the creator can confirm");
    assertTransition(sub.status, "CREATOR_CONFIRMED");
    const version = latestVersion(db.assetVersions, sub.id);
    if (!version || version.validationStatus !== "PASSED") throw new Error("no validated asset to confirm");
    version.confirmedAt = new Date().toISOString();
    sub.status = "CREATOR_CONFIRMED";
    sub.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: `discord:${actorDiscordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "CREATOR_CONFIRMED",
      metadata: { version: version.version },
    });
    return sub;
  });
}

export async function requestPublication(submissionId: string, actorDiscordUserId: string): Promise<Submission> {
  const pubRights = await acceptRights(submissionId, actorDiscordUserId, null, "publication");
  return withStore((db) => {
    const sub = findSub(db.submissions, pubRights.id);
    assertTransition(sub.status, "PUBLICATION_REQUESTED");
    sub.status = "PUBLICATION_REQUESTED";
    sub.updatedAt = new Date().toISOString();
    db.publicationRequests.push({
      id: uuid(),
      submissionId: sub.id,
      requestedAt: sub.updatedAt,
      reviewMessageId: null,
    });
    appendAudit(db, {
      actor: `discord:${actorDiscordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "PUBLICATION_REQUESTED",
      metadata: {},
    });
    return sub;
  });
}

export async function markUnderReview(submissionId: string, messageId: string | null): Promise<void> {
  await withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    if (sub.status === "PUBLICATION_REQUESTED") {
      assertTransition(sub.status, "UNDER_REVIEW");
      sub.status = "UNDER_REVIEW";
      sub.updatedAt = new Date().toISOString();
    }
    const req = db.publicationRequests.filter((p) => p.submissionId === sub.id).at(-1);
    if (req && messageId) req.reviewMessageId = messageId;
  });
}

export async function approveForCommitment(submissionId: string, adminDiscordUserId: string): Promise<Submission> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    assertTransition(sub.status, "APPROVED_FOR_COMMITMENT");
    sub.status = "APPROVED_FOR_COMMITMENT";
    sub.updatedAt = new Date().toISOString();
    db.moderationDecisions.push({
      id: uuid(),
      submissionId: sub.id,
      adminDiscordUserId,
      decision: "APPROVED",
      reason: "approved for commitment",
      createdAt: sub.updatedAt,
    });
    appendAudit(db, {
      actor: `admin:${adminDiscordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "ADMIN_APPROVED",
      metadata: {},
    });
    return sub;
  });
}

export async function rejectSubmission(
  submissionId: string,
  adminDiscordUserId: string,
  reason: string
): Promise<Submission> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    assertTransition(sub.status, "REJECTED");
    sub.status = "REJECTED";
    sub.updatedAt = new Date().toISOString();
    db.moderationDecisions.push({
      id: uuid(),
      submissionId: sub.id,
      adminDiscordUserId,
      decision: "REJECTED",
      reason,
      createdAt: sub.updatedAt,
    });
    appendAudit(db, {
      actor: `admin:${adminDiscordUserId}`,
      entityType: "submission",
      entityId: sub.id,
      eventType: "ADMIN_REJECTED",
      metadata: { reason },
    });
    return sub;
  });
}

export async function requestChanges(
  submissionId: string,
  adminDiscordUserId: string,
  reason: string
): Promise<Submission> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    assertTransition(sub.status, "CHANGES_REQUESTED");
    sub.status = "CHANGES_REQUESTED";
    sub.updatedAt = new Date().toISOString();
    db.moderationDecisions.push({
      id: uuid(),
      submissionId: sub.id,
      adminDiscordUserId,
      decision: "CHANGES_REQUESTED",
      reason,
      createdAt: sub.updatedAt,
    });
    return sub;
  });
}

export async function issueQuote(submissionId: string, adminDiscordUserId: string): Promise<CommitmentQuote> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    if (sub.status !== "APPROVED_FOR_COMMITMENT" && sub.status !== "QUOTE_ISSUED") {
      if (sub.status === "UNDER_REVIEW") {
        assertTransition(sub.status, "APPROVED_FOR_COMMITMENT");
        sub.status = "APPROVED_FOR_COMMITMENT";
      }
    }
    if (sub.status === "APPROVED_FOR_COMMITMENT") {
      assertTransition(sub.status, "QUOTE_ISSUED");
    }
    const policy = quoteForDuration(sub.requestedDurationKey);
    const now = Date.now();
    const quote: CommitmentQuote = {
      id: uuid(),
      submissionId: sub.id,
      walletAddress: null,
      mint: policy.mint,
      requiredAmount: policy.amountBaseUnits,
      requiredDurationSeconds: policy.durationSeconds,
      minimumUnlockAt: null,
      policyVersion: policy.policyVersion,
      expiresAt: new Date(now + QUOTE_TTL_HOURS * 3600 * 1000).toISOString(),
      status: "OPEN",
      createdBy: adminDiscordUserId,
      createdAt: new Date(now).toISOString(),
    };
    db.commitmentQuotes.push(quote);
    sub.status = "QUOTE_ISSUED";
    sub.updatedAt = quote.createdAt;
    appendAudit(db, {
      actor: `admin:${adminDiscordUserId}`,
      entityType: "quote",
      entityId: quote.id,
      eventType: "QUOTE_ISSUED",
      metadata: { amount: quote.requiredAmount, duration: sub.requestedDurationKey },
    });
    return quote;
  });
}

export async function cancelSubmission(submissionId: string, actorDiscordUserId: string): Promise<void> {
  await withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    if (sub.discordUserId !== actorDiscordUserId) throw new Error("only the creator can cancel");
    assertTransition(sub.status, "CANCELLED");
    sub.status = "CANCELLED";
    sub.updatedAt = new Date().toISOString();
  });
}

export async function optOut(submissionId: string, actorDiscordUserId: string, isAdmin = false): Promise<WorldAsset> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    if (!isAdmin && sub.discordUserId !== actorDiscordUserId) {
      throw new Error("only the creator can opt out");
    }
    const asset = db.worldAssets.filter((a) => a.submissionId === sub.id).at(-1);
    if (!asset) throw new Error("no world asset to opt out");
    asset.status = "OPTED_OUT";
    asset.optedOutAt = new Date().toISOString();
    sub.status = "OPTED_OUT";
    sub.updatedAt = asset.optedOutAt;
    db.manifestVersion += 1;
    appendAudit(db, {
      actor: `discord:${actorDiscordUserId}`,
      entityType: "world_asset",
      entityId: asset.id,
      eventType: "CREATOR_OPTED_OUT",
      metadata: {},
    });
    return asset;
  });
}

export async function suspendAsset(
  submissionId: string,
  adminDiscordUserId: string,
  reason: string
): Promise<WorldAsset> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    const asset = db.worldAssets.filter((a) => a.submissionId === sub.id).at(-1);
    if (!asset) throw new Error("no world asset");
    asset.status = "SUSPENDED";
    asset.suspendedAt = new Date().toISOString();
    asset.removalReason = reason;
    sub.status = "SUSPENDED";
    sub.updatedAt = asset.suspendedAt;
    db.manifestVersion += 1;
    db.moderationDecisions.push({
      id: uuid(),
      submissionId: sub.id,
      adminDiscordUserId,
      decision: "SUSPENDED",
      reason,
      createdAt: asset.suspendedAt,
    });
    appendAudit(db, {
      actor: `admin:${adminDiscordUserId}`,
      entityType: "world_asset",
      entityId: asset.id,
      eventType: "ASSET_SUSPENDED",
      metadata: { reason },
    });
    return asset;
  });
}

export async function restoreAsset(submissionId: string, adminDiscordUserId: string): Promise<WorldAsset> {
  return withStore((db) => {
    const sub = findSub(db.submissions, submissionId);
    const asset = db.worldAssets.filter((a) => a.submissionId === sub.id).at(-1);
    if (!asset) throw new Error("no world asset");
    asset.status = "ACTIVE";
    asset.suspendedAt = null;
    sub.status = "ACTIVE";
    sub.updatedAt = new Date().toISOString();
    db.manifestVersion += 1;
    db.moderationDecisions.push({
      id: uuid(),
      submissionId: sub.id,
      adminDiscordUserId,
      decision: "RESTORED",
      reason: "restored",
      createdAt: sub.updatedAt,
    });
    return asset;
  });
}

export async function createReport(input: {
  publicId: string;
  reporterUserId: string | null;
  category: ReportCategory;
  description: string;
  evidenceUrl: string | null;
}): Promise<void> {
  await withStore((db) => {
    const sub = findSub(db.submissions, input.publicId);
    const asset = db.worldAssets.filter((a) => a.submissionId === sub.id).at(-1);
    db.reports.push({
      id: uuid(),
      worldAssetId: asset?.id || null,
      submissionPublicId: sub.publicId,
      reporterUserId: input.reporterUserId,
      category: input.category,
      description: input.description,
      evidenceUrl: input.evidenceUrl,
      rightsHolderClaim: input.category === "COPYRIGHT" || input.category === "TRADEMARK",
      status: "OPEN",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      decision: null,
    });
    appendAudit(db, {
      actor: input.reporterUserId ? `discord:${input.reporterUserId}` : "public",
      entityType: "report",
      entityId: sub.id,
      eventType: "REPORT_RECEIVED",
      metadata: { category: input.category },
    });
  });
}

export function findSub(list: Submission[], idOrPublic: string): Submission {
  const sub = list.find((s) => s.id === idOrPublic || s.publicId.toUpperCase() === idOrPublic.toUpperCase());
  if (!sub) throw new Error(`submission ${idOrPublic} not found`);
  return sub;
}

export function latestVersion(list: AssetVersion[], submissionId: string): AssetVersion | undefined {
  return list.filter((v) => v.submissionId === submissionId).sort((a, b) => b.version - a.version)[0];
}

export function linksFor(sub: Submission) {
  return {
    preview: previewUrl(sub.id),
    commit: commitUrl(sub.id),
    origin: CREATOR_BASE_URL,
    file: (key: string) => fileUrl(key),
    pastaMint: PASTA_MINT,
    programId: PROGRAM_ID,
  };
}
