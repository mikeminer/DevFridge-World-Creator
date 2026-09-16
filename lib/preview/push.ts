import { CREATOR_BASE_URL, SESSION_SECRET } from "../config";
import { savePreviewRecord, putGlb } from "./catalog";
import type { PreviewRecord } from "./types";

export async function publishGeneratedPreview(input: {
  id: string;
  publicId: string;
  name: string;
  projectName: string;
  status: string;
  version: number;
  fileBytes: number;
  sha256: string;
  glb: Buffer;
  thumbnailUrl?: string | null;
}): Promise<PreviewRecord> {
  const glbUrl = await putGlb(input.id, input.version, input.glb);
  const record: PreviewRecord = {
    id: input.id,
    publicId: input.publicId,
    name: input.name,
    projectName: input.projectName,
    status: input.status,
    version: input.version,
    fileBytes: input.fileBytes,
    sha256: input.sha256,
    glbUrl,
    thumbnailUrl: input.thumbnailUrl || null,
    publishedAt: new Date().toISOString(),
  };
  await savePreviewRecord(record);

  const remote =
    !process.env.VERCEL &&
    CREATOR_BASE_URL.startsWith("https://") &&
    !CREATOR_BASE_URL.includes("localhost");
  if (remote) {
    try {
      await fetch(`${CREATOR_BASE_URL}/api/v1/preview/publish`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${SESSION_SECRET}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...record,
          glbBase64: input.glb.toString("base64"),
        }),
      });
    } catch (err) {
      console.error("preview publish to Vercel failed", err);
    }
  }
  return record;
}
