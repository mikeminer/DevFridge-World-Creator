import { waitUntil } from "@vercel/functions";

function keepAlive(task: Promise<unknown>) {
  try {
    waitUntil(task);
  } catch {
    /* local / gateway */
  }
  void task.catch((err) => console.error("background task", err));
}

import {
  DISCORD_ADMIN_ROLE_ID,
  DISCORD_ADMIN_USER_IDS,
  DISCORD_CREATOR_CHANNEL_ID,
  DISCORD_REVIEW_CHANNEL_ID,
  DISCORD_REVIEW_GUILD_ID,
  baseUnitsToPasta,
} from "../config";
import { COMMITMENT_COPY, HELP_TEXT, OPTOUT_COPY, submissionCreatedMessage, GENERATION_RIGHTS_STATEMENT } from "../copy";
import { processQueuedJobs } from "../generation/run";
import { commitUrl, previewUrl } from "../ids";
import {
  acceptRights,
  approveForCommitment,
  cancelSubmission,
  confirmAsset,
  createReport,
  createSubmission,
  findSub,
  issueQuote,
  latestVersion,
  markUnderReview,
  optOut,
  rejectSubmission,
  requestChanges,
  requestPublication,
  restoreAsset,
  startGeneration,
  suspendAsset,
} from "../sdk";
import { readStore } from "../store";
import type { ReportCategory, Submission } from "../types";
import { notifyQuote } from "./notify";
import {
  adminButtons,
  optoutButtons,
  optoutPrompt,
  previewButtons,
  publishButtons,
  reviewCard,
  rightsButtons,
  row,
  statusEmbed,
  link,
} from "./payloads";
import {
  CHANNEL_MESSAGE_WITH_SOURCE,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  EPHEMERAL,
  UPDATE_MESSAGE,
  editOriginal,
  postChannel,
} from "./rest";

type Interaction = {
  id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user?: { id: string; username: string; global_name?: string };
    roles?: string[];
    permissions?: string;
  };
  user?: { id: string; username: string; global_name?: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: Option[];
    resolved?: {
      attachments?: Record<string, { id: string; filename: string; url: string; size: number; content_type?: string }>;
    };
  };
};

type Option = { name: string; type: number; value?: unknown; options?: Option[] };

function actor(i: Interaction) {
  const u = i.member?.user || i.user;
  if (!u) throw new Error("missing user");
  return { id: u.id, username: u.global_name || u.username };
}

function optMap(options?: Option[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const o of options || []) {
    if (o.options) Object.assign(out, optMap(o.options));
    else if (o.value !== undefined) out[o.name] = o.value;
  }
  return out;
}

function subcommand(i: Interaction): { group: string; name: string; opts: Record<string, unknown> } {
  const group = i.data?.name || "";
  const first = i.data?.options?.[0];
  return { group, name: first?.name || "", opts: optMap(i.data?.options) };
}

function ephemeral(content: string, extra: Record<string, unknown> = {}) {
  return {
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL, ...extra },
  };
}

function deferEphemeral() {
  return { type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: EPHEMERAL } };
}

function update(content: string, extra: Record<string, unknown> = {}) {
  return { type: UPDATE_MESSAGE, data: { content, ...extra } };
}

export function isAdmin(i: Interaction): boolean {
  const id = actor(i).id;
  if (DISCORD_ADMIN_USER_IDS.includes(id)) return true;
  if (DISCORD_ADMIN_ROLE_ID && i.member?.roles?.includes(DISCORD_ADMIN_ROLE_ID)) return true;
  const perms = BigInt(i.member?.permissions || "0");
  if (perms & 0x8n) return true;
  return false;
}

function assertCreatorChannel(i: Interaction) {
  if (i.guild_id && i.guild_id !== DISCORD_REVIEW_GUILD_ID) {
    throw new Error("World Creator is only enabled in the DevFridge Discord.");
  }
  if (i.channel_id && i.channel_id !== DISCORD_CREATOR_CHANNEL_ID) {
    throw new Error(`Use this command in <#${DISCORD_CREATOR_CHANNEL_ID}>.`);
  }
}

export async function handleInteraction(i: Interaction): Promise<unknown> {
  if (i.type === 1) return { type: 1 };
  if (i.type === 2) return handleCommand(i);
  if (i.type === 3) return handleComponent(i);
  if (i.type === 5) return handleModal(i);
  return ephemeral("Unsupported interaction.");
}

async function handleCommand(i: Interaction): Promise<unknown> {
  const { group, name, opts } = subcommand(i);
  try {
    if (group === "world") {
      if (name === "help") return ephemeral(HELP_TEXT);
      if (name === "create") {
        assertCreatorChannel(i);
        return handleCreate(i, opts);
      }
      if (name === "status") return handleStatus(i, String(opts.id || ""));
      if (name === "preview") return handlePreview(i, String(opts.id || ""));
      if (name === "my-assets") return handleMine(i);
      if (name === "optout") return handleOptoutAsk(i, String(opts.id || ""));
      if (name === "report") return handleReport(i, opts);
    }
    if (group === "world-admin") {
      if (!isAdmin(i)) return ephemeral("Admin only.");
      if (name === "queue") return handleQueue();
      if (name === "review") return handleAdminReview(String(opts.id || ""));
      if (name === "approve") return handleAdminApprove(i, String(opts.id || ""));
      if (name === "reject") return handleAdminReject(i, String(opts.id || ""), String(opts.reason || ""));
      if (name === "quote") return handleAdminQuote(i, String(opts.id || ""));
      if (name === "suspend") return handleAdminSuspend(i, String(opts.id || ""), String(opts.reason || "suspended"));
      if (name === "restore") return handleAdminRestore(i, String(opts.id || ""));
    }
    return ephemeral("Unknown command. Try `/world help`.");
  } catch (err) {
    return ephemeral(err instanceof Error ? err.message : String(err));
  }
}

function handleCreate(i: Interaction, opts: Record<string, unknown>) {
  const attachments = ["image", "image2", "image3", "image4"]
    .map((k) => {
      const id = opts[k];
      if (id == null) return null;
      return i.data?.resolved?.attachments?.[String(id)] || null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const user = actor(i);
  keepAlive(
    (async () => {
      try {
        const sub = await createSubmission({
          discordUserId: user.id,
          discordUsername: user.username,
          discordChannelId: i.channel_id || DISCORD_CREATOR_CHANNEL_ID,
          discordGuildId: i.guild_id || DISCORD_REVIEW_GUILD_ID,
          discordInteractionId: i.id,
          name: String(opts.name || ""),
          projectName: String(opts.community || ""),
          description: String(opts.description || ""),
          durationKey: String(opts.duration || "30d"),
          tokenMint: opts.mint ? String(opts.mint) : null,
          website: opts.website ? String(opts.website) : null,
          xAccount: opts.x ? String(opts.x) : null,
          notes: opts.notes ? String(opts.notes) : null,
          attachments,
        });
        await editOriginal(i.token, {
          content: `${submissionCreatedMessage(sub.publicId)}\n\n${GENERATION_RIGHTS_STATEMENT}`,
          components: rightsButtons(sub.id),
        });
      } catch (err) {
        await editOriginal(i.token, {
          content: `Could not create submission: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    })()
  );
  return deferEphemeral();
}

async function handleStatus(i: Interaction, id: string) {
  const user = actor(i);
  const data = await readStore((db) => {
    const list = id
      ? [findSub(db.submissions, id)]
      : db.submissions.filter((s) => s.discordUserId === user.id).slice(-5);
    return list.map((sub) => {
      const version = latestVersion(db.assetVersions, sub.id);
      const quote = db.commitmentQuotes.filter((q) => q.submissionId === sub.id).at(-1);
      const commitment = db.commitments.filter((c) => c.submissionId === sub.id).at(-1);
      const asset = db.worldAssets.filter((a) => a.submissionId === sub.id).at(-1);
      return { sub, version, quote, commitment, asset };
    });
  });
  if (!data.length) return ephemeral("No submissions yet. Run `/world create` in this channel.");
  return {
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: EPHEMERAL,
      embeds: data.map(({ sub, version, quote, commitment, asset }) =>
        statusEmbed(sub, {
          Generation: version ? `v${version.version} ${version.validationStatus}` : "waiting",
          Confirmation: version?.confirmedAt ? "complete" : "pending",
          Commitment: commitment?.status || quote?.status || "none",
          Asset: asset?.status || "not active",
        })
      ),
    },
  };
}

async function handlePreview(i: Interaction, id: string) {
  const user = actor(i);
  const sub = await readStore((db) => findSub(db.submissions, id));
  if (sub.discordUserId !== user.id && !isAdmin(i)) return ephemeral("Not your submission.");
  return ephemeral(`3D preview for **${sub.publicId}**`, {
    components: [row(link("Open 3D Preview", previewUrl(sub.id)))],
  });
}

async function handleMine(i: Interaction) {
  return handleStatus(i, "");
}

async function handleOptoutAsk(i: Interaction, id: string) {
  const user = actor(i);
  const sub = await readStore((db) => findSub(db.submissions, id));
  if (sub.discordUserId !== user.id) return ephemeral("Not your asset.");
  return ephemeral(optoutPrompt(sub.publicId), { components: optoutButtons(sub.id) });
}

async function handleReport(i: Interaction, opts: Record<string, unknown>) {
  const user = actor(i);
  await createReport({
    publicId: String(opts.id || ""),
    reporterUserId: user.id,
    category: String(opts.category || "OTHER") as ReportCategory,
    description: String(opts.description || ""),
    evidenceUrl: opts.evidence ? String(opts.evidence) : null,
  });
  return ephemeral(
    "Report recorded. Reports do not automatically remove an asset. A human reviews evidence. Thanks."
  );
}

async function handleQueue() {
  const rows = await readStore((db) =>
    db.submissions.filter((s) =>
      ["PUBLICATION_REQUESTED", "UNDER_REVIEW", "APPROVED_FOR_COMMITMENT", "QUOTE_ISSUED"].includes(s.status)
    )
  );
  if (!rows.length) return ephemeral("Review queue is empty.");
  const lines = rows.map((s) => `• **${s.publicId}** ${s.name} — \`${s.status}\``).join("\n");
  return ephemeral(lines);
}

async function handleAdminReview(id: string) {
  const ctx = await loadReview(id);
  return {
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: EPHEMERAL,
      embeds: [reviewCard(ctx.sub, ctx.version, ctx.sources, ctx.quote)],
      components: adminButtons(ctx.sub.id),
    },
  };
}

async function handleAdminApprove(i: Interaction, id: string) {
  const sub = await approveForCommitment(id, actor(i).id);
  const quote = await issueQuote(sub.id, actor(i).id);
  keepAlive(notifyQuote(sub.id, quote.requiredAmount, sub.requestedDurationKey));
  return ephemeral(
    `Approved **${sub.publicId}**. Quote: ${baseUnitsToPasta(quote.requiredAmount)} $PASTA / ${sub.requestedDurationKey}.`
  );
}

async function handleAdminReject(i: Interaction, id: string, reason: string) {
  const sub = await rejectSubmission(id, actor(i).id, reason || "rejected");
  return ephemeral(`Rejected **${sub.publicId}**: ${reason}`);
}

async function handleAdminQuote(i: Interaction, id: string) {
  const quote = await issueQuote(id, actor(i).id);
  const sub = await readStore((db) => findSub(db.submissions, id));
  keepAlive(notifyQuote(sub.id, quote.requiredAmount, sub.requestedDurationKey));
  return ephemeral(`Quote issued for **${sub.publicId}**: ${baseUnitsToPasta(quote.requiredAmount)} $PASTA.`);
}

async function handleAdminSuspend(i: Interaction, id: string, reason: string) {
  await suspendAsset(id, actor(i).id, reason);
  return ephemeral(`Suspended **${id}**. $PASTA remains governed by the on-chain unlock time.`);
}

async function handleAdminRestore(i: Interaction, id: string) {
  await restoreAsset(id, actor(i).id);
  return ephemeral(`Restored **${id}**.`);
}

async function handleComponent(i: Interaction): Promise<unknown> {
  const custom = i.data?.custom_id || "";
  const [kind, action, ...rest] = custom.split(":");
  const id = rest.join(":") || action;
  const user = actor(i);
  try {
    if (kind === "rights" && action === "accept") {
      const sub = await acceptRights(id, user.id, i.id, "generation");
      keepAlive(
        (async () => {
          await startGeneration(sub.id);
          await processQueuedJobs();
        })()
      );
      return update(
        `🍝 **${sub.publicId}** rights recorded.\n3D generation is queued. You will get a preview before publication.`
      );
    }
    if (kind === "rights" && action === "cancel") {
      await cancelSubmission(id, user.id);
      return update("Submission cancelled.");
    }
    if (kind === "confirm") {
      const sub = await confirmAsset(id, user.id);
      return update(`**${sub.publicId}** confirmed.`, { components: publishButtons(sub.id) });
    }
    if (kind === "regen") {
      const sub = await readStore((db) => findSub(db.submissions, id));
      if (sub.discordUserId !== user.id) return ephemeral("Not your submission.");
      keepAlive(
        (async () => {
          await startGeneration(sub.id);
          await processQueuedJobs();
        })()
      );
      return update(`Regeneration queued for **${sub.publicId}** (max ${3} attempts).`);
    }
    if (kind === "cancel") {
      await cancelSubmission(id, user.id);
      return update("Cancelled.");
    }
    if (kind === "publish") {
      const sub = await requestPublication(id, user.id);
      keepAlive(postReviewCard(sub));
      return update(
        `**${sub.publicId}** sent for DevFridge review. Nothing is eligible in World until approval and a verified $PASTA commitment.`
      );
    }
    if (kind === "optout" && action === "confirm") {
      await optOut(id, user.id, false);
      return update(`Opted out. ${OPTOUT_COPY}`);
    }
    if (kind === "optout" && action === "cancel") {
      return update("Opt-out cancelled.");
    }
    if (kind === "admin") {
      if (!isAdmin(i)) return ephemeral("Admin only.");
      if (action === "approve") return handleAdminApprove(i, id);
      if (action === "reject") return handleAdminReject(i, id, "rejected from review card");
      if (action === "changes") {
        await requestChanges(id, user.id, "changes requested from review card");
        return ephemeral("Marked as changes requested.");
      }
      if (action === "quote") return handleAdminQuote(i, id);
    }
    return ephemeral("Unknown action.");
  } catch (err) {
    return ephemeral(err instanceof Error ? err.message : String(err));
  }
}

async function handleModal(_i: Interaction): Promise<unknown> {
  return ephemeral("Modal received.");
}

async function loadReview(id: string) {
  return readStore((db) => {
    const sub = findSub(db.submissions, id);
    return {
      sub,
      version: latestVersion(db.assetVersions, sub.id) || null,
      sources: db.sourceFiles.filter((f) => f.submissionId === sub.id).length,
      quote: db.commitmentQuotes.filter((q) => q.submissionId === sub.id).at(-1) || null,
    };
  });
}

async function postReviewCard(sub: Submission): Promise<void> {
  const ctx = await loadReview(sub.id);
  const msg = await postChannel(DISCORD_REVIEW_CHANNEL_ID, {
    content: `Review **${sub.publicId}** from <@${sub.discordUserId}>`,
    embeds: [reviewCard(ctx.sub, ctx.version, ctx.sources, ctx.quote)],
    components: adminButtons(ctx.sub.id),
  });
  await markUnderReview(sub.id, msg?.id || null);
}

export { COMMITMENT_COPY, commitUrl };
