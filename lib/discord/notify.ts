import { COMMITMENT_COPY } from "../copy";
import { commitUrl, previewUrl } from "../ids";
import { baseUnitsToPasta } from "../config";
import { readStore } from "../store";
import { dmUser, postChannel } from "./rest";
import { previewButtons, publishButtons, row, link, EMBED_COLOR } from "./payloads";

export async function notifyGenerationReady(submissionId: string): Promise<void> {
  const ctx = await readStore((db) => {
    const sub = db.submissions.find((s) => s.id === submissionId);
    const version = sub
      ? db.assetVersions.filter((v) => v.submissionId === sub.id).sort((a, b) => b.version - a.version)[0]
      : null;
    return { sub, version };
  });
  if (!ctx.sub) return;
  const payload = {
    content: `🍝 **${ctx.sub.publicId}** — your 3D character is ready.\nPreview it before anything is submitted for publication.`,
    embeds: [
      {
        title: ctx.sub.name,
        color: EMBED_COLOR,
        description: `${ctx.sub.projectName}\nGLB ${(ctx.version ? ctx.version.fileBytes / 1024 : 0).toFixed(1)} KB`,
        footer: { text: "Confirm only if you have the rights to publish this asset." },
      },
    ],
    components: previewButtons(ctx.sub.id),
  };
  await dmUser(ctx.sub.discordUserId, payload).catch(() => undefined);
  if (ctx.sub.discordChannelId) {
    await postChannel(ctx.sub.discordChannelId, payload).catch(() => undefined);
  }
}

export async function notifyQuote(submissionId: string, amount: string, durationKey: string): Promise<void> {
  const sub = await readStore((db) => db.submissions.find((s) => s.id === submissionId));
  if (!sub) return;
  const payload = {
    content: [
      `🍝 **${sub.publicId}** is approved. Complete the $PASTA commitment to make it eligible.`,
      "",
      `Required: **${baseUnitsToPasta(amount)} $PASTA** for **${durationKey}**.`,
      COMMITMENT_COPY,
    ].join("\n"),
    components: [row(link("Complete commitment", commitUrl(sub.id)), link("Preview", previewUrl(sub.id)))],
  };
  await dmUser(sub.discordUserId, payload).catch(() => undefined);
  if (sub.discordChannelId) await postChannel(sub.discordChannelId, payload).catch(() => undefined);
}

export async function notifyActivated(submissionId: string): Promise<void> {
  const sub = await readStore((db) => db.submissions.find((s) => s.id === submissionId));
  if (!sub) return;
  const payload = {
    content: `🍝 **${sub.publicId} (${sub.name})** is now eligible in DevFridge World for the verified commitment window.\nCommunity adoption determines how much it is played.`,
  };
  await dmUser(sub.discordUserId, payload).catch(() => undefined);
  if (sub.discordChannelId) await postChannel(sub.discordChannelId, payload).catch(() => undefined);
}

export { publishButtons };
