import { baseUnitsToPasta } from "../config";
import { commitUrl, previewUrl } from "../ids";
import { OPTOUT_COPY } from "../copy";
import type { AssetVersion, CommitmentQuote, Submission } from "../types";

export const EMBED_COLOR = 0xed4a35;

export function btn(customId: string, label: string, style = 1) {
  return { type: 2, style, custom_id: customId, label };
}

export function link(label: string, url: string) {
  return { type: 2, style: 5, label, url };
}

export function row(...components: unknown[]) {
  return { type: 1, components };
}

export function rightsButtons(submissionId: string) {
  return [
    row(
      btn(`rights:accept:${submissionId}`, "I have the rights", 3),
      btn(`rights:cancel:${submissionId}`, "Cancel", 4)
    ),
  ];
}

export function previewButtons(submissionId: string) {
  return [
    row(
      link("Open 3D Preview", previewUrl(submissionId)),
      btn(`confirm:${submissionId}`, "Confirm", 3),
      btn(`regen:${submissionId}`, "Regenerate", 2),
      btn(`cancel:${submissionId}`, "Cancel", 4)
    ),
  ];
}

export function publishButtons(submissionId: string) {
  return [
    row(
      btn(`publish:${submissionId}`, "Request publication", 1),
      link("Open 3D Preview", previewUrl(submissionId))
    ),
  ];
}

export function optoutButtons(submissionId: string) {
  return [
    row(
      btn(`optout:confirm:${submissionId}`, "Confirm opt-out", 4),
      btn(`optout:cancel:${submissionId}`, "Cancel", 2)
    ),
  ];
}

export function adminButtons(submissionId: string) {
  return [
    row(
      link("3D Preview", previewUrl(submissionId)),
      btn(`admin:approve:${submissionId}`, "Approve for commitment", 3),
      btn(`admin:changes:${submissionId}`, "Request changes", 2),
      btn(`admin:reject:${submissionId}`, "Reject", 4)
    ),
    row(btn(`admin:quote:${submissionId}`, "Issue quote", 1)),
  ];
}

export function statusEmbed(sub: Submission, extra: Record<string, string>): Record<string, unknown> {
  return {
    title: `${sub.publicId} · ${sub.name}`,
    color: EMBED_COLOR,
    description: sub.description,
    fields: [
      { name: "Community", value: sub.projectName, inline: true },
      { name: "Status", value: sub.status, inline: true },
      { name: "Duration", value: sub.requestedDurationKey, inline: true },
      ...Object.entries(extra).map(([name, value]) => ({ name, value: value || "—", inline: true })),
    ],
    footer: { text: "DevFridge World Creator · commitment ≠ IP license" },
  };
}

export function reviewCard(
  sub: Submission,
  version: AssetVersion | null,
  sources: number,
  quote: CommitmentQuote | null
) {
  return {
    title: "🍝 DevFridge World Publication Request",
    color: EMBED_COLOR,
    fields: [
      { name: "ID", value: sub.publicId, inline: true },
      { name: "Asset", value: sub.name, inline: true },
      { name: "Community", value: sub.projectName, inline: true },
      { name: "Status", value: sub.status, inline: true },
      { name: "Token mint", value: sub.tokenMint || "none", inline: false },
      { name: "Source files", value: String(sources), inline: true },
      {
        name: "GLB",
        value: version
          ? `${(version.fileBytes / 1024 / 1024).toFixed(2)} MB · ${version.triangleCount} tris`
          : "none",
        inline: true,
      },
      {
        name: "Quote",
        value: quote
          ? `${baseUnitsToPasta(quote.requiredAmount)} $PASTA / ${sub.requestedDurationKey}`
          : "not issued",
        inline: true,
      },
    ],
    footer: { text: "A commitment does not grant IP rights." },
  };
}

export function optoutPrompt(publicId: string): string {
  return [
    `Remove **${publicId}** from DevFridge World?`,
    "",
    OPTOUT_COPY,
  ].join("\n");
}
