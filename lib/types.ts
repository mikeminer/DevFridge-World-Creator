export type SubmissionStatus =
  | "DRAFT"
  | "SOURCE_RECEIVED"
  | "RIGHTS_ATTESTED"
  | "GENERATION_QUEUED"
  | "GENERATING"
  | "GENERATED"
  | "PREVIEW_READY"
  | "CREATOR_CONFIRMED"
  | "PUBLICATION_REQUESTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "APPROVED_FOR_COMMITMENT"
  | "QUOTE_ISSUED"
  | "COMMITMENT_PENDING"
  | "COMMITMENT_CONFIRMED"
  | "SCHEDULED"
  | "ACTIVE"
  | "OPTED_OUT"
  | "SUSPENDED"
  | "REMOVED"
  | "EXPIRED"
  | "CANCELLED";

export type CommitmentStatus =
  | "NONE"
  | "QUOTE_ISSUED"
  | "TX_PENDING"
  | "LOCK_CONFIRMED"
  | "LOCK_MATURED"
  | "CLAIMED"
  | "FAILED";

export type ReportCategory =
  | "COPYRIGHT"
  | "TRADEMARK"
  | "PERSONALITY_LIKENESS"
  | "STOLEN_ASSET"
  | "IMPERSONATION"
  | "ILLEGAL_CONTENT"
  | "SAFETY"
  | "SCAM"
  | "OTHER";

export type User = {
  id: string;
  discordUserId: string;
  discordUsername: string;
  createdAt: string;
  status: "active" | "suspended";
};

export type WalletLink = {
  id: string;
  userId: string;
  walletAddress: string;
  verifiedAt: string;
  revokedAt: string | null;
  verificationNonceHash: string;
};

export type Submission = {
  id: string;
  publicId: string;
  creatorUserId: string;
  discordUserId: string;
  discordChannelId: string;
  discordGuildId: string;
  name: string;
  projectName: string;
  description: string;
  tokenMint: string | null;
  website: string | null;
  xAccount: string | null;
  notes: string | null;
  requestedDurationKey: string;
  requestedDurationSeconds: number;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
};

export type SourceFile = {
  id: string;
  submissionId: string;
  originalFilename: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  storageKey: string;
  uploadedAt: string;
  discordAttachmentId: string | null;
  moderationStatus: "PASSED" | "REJECTED";
};

export type RightsAttestation = {
  id: string;
  submissionId: string;
  userId: string;
  walletAddress: string | null;
  attestationVersion: string;
  statementHash: string;
  statement: string;
  acceptedAt: string;
  discordInteractionId: string | null;
  stage: "generation" | "publication";
};

export type GenerationJob = {
  id: string;
  submissionId: string;
  provider: string;
  providerTaskId: string | null;
  model: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempt: number;
  costUnits: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type AssetVersion = {
  id: string;
  submissionId: string;
  version: number;
  rawGlbKey: string;
  finalGlbKey: string;
  finalGlbSha256: string;
  thumbnailKey: string;
  triangleCount: number;
  textureBytes: number;
  fileBytes: number;
  rigged: boolean;
  validationStatus: "PASSED" | "FAILED";
  createdAt: string;
  confirmedAt: string | null;
};

export type PublicationRequest = {
  id: string;
  submissionId: string;
  requestedAt: string;
  reviewMessageId: string | null;
};

export type ModerationDecision = {
  id: string;
  submissionId: string;
  adminDiscordUserId: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "SUSPENDED" | "RESTORED";
  reason: string;
  createdAt: string;
};

export type CommitmentQuote = {
  id: string;
  submissionId: string;
  walletAddress: string | null;
  mint: string;
  requiredAmount: string;
  requiredDurationSeconds: number;
  minimumUnlockAt: string | null;
  policyVersion: string;
  expiresAt: string;
  status: "OPEN" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  createdBy: string;
  createdAt: string;
};

export type Commitment = {
  id: string;
  quoteId: string;
  submissionId: string;
  walletAddress: string;
  mint: string;
  programId: string;
  vaultAddress: string | null;
  amount: string;
  createdAtChain: string | null;
  unlockAt: string | null;
  txSignature: string | null;
  confirmedSlot: number | null;
  finalized: boolean;
  claimedAt: string | null;
  claimTxSignature: string | null;
  burnAmount: string | null;
  status: CommitmentStatus;
  lastVerifiedAt: string | null;
};

export type WorldAsset = {
  id: string;
  submissionId: string;
  assetVersionId: string;
  commitmentId: string;
  publicId: string;
  status: "SCHEDULED" | "ACTIVE" | "OPTED_OUT" | "SUSPENDED" | "REMOVED" | "EXPIRED";
  activeFrom: string;
  activeUntil: string;
  optedOutAt: string | null;
  suspendedAt: string | null;
  removalReason: string | null;
  manifestVersion: number;
};

export type Report = {
  id: string;
  worldAssetId: string | null;
  submissionPublicId: string;
  reporterUserId: string | null;
  category: ReportCategory;
  description: string;
  evidenceUrl: string | null;
  rightsHolderClaim: boolean;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
  decision: string | null;
};

export type AuditEvent = {
  id: string;
  actor: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  eventType: string;
  metadata: Record<string, unknown>;
};

export type AuthNonce = {
  id: string;
  userId: string;
  discordUserId: string;
  nonce: string;
  domain: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type EligibilityContext = {
  creatorConfirmed: boolean;
  rightsAttested: boolean;
  assetValidated: boolean;
  publicationApproved: boolean;
  commitmentFinalized: boolean;
  commitmentMeetsQuote: boolean;
  now: number;
  activeFrom: number;
  activeUntil: number;
  optedOut: boolean;
  suspended: boolean;
  removed: boolean;
};

export type WorldManifestAsset = {
  asset_id: string;
  version: number;
  name: string;
  glb_url: string;
  sha256: string;
  thumbnail_url: string;
  active_from: string;
  active_until: string;
  creator: { display_name: string };
  community: { name: string; mint: string | null };
  runtime: {
    scale: number;
    ground_offset: number;
    collider: string;
    lod: boolean;
  };
};

export type WorldManifest = {
  version: number;
  generated_at: string;
  season: string;
  assets: WorldManifestAsset[];
};
