import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PreviewRecord } from "./types";

const DIR = join(process.cwd(), "data", "previews");

function localPath(id: string): string {
  return join(DIR, `${id}.json`);
}

export async function savePreviewRecord(record: PreviewRecord): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    await put(`world-creator/previews/${record.id}.json`, JSON.stringify(record), {
      access: "public",
      addRandomSuffix: false,
      token,
      contentType: "application/json",
    });
    return;
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(localPath(record.id), JSON.stringify(record, null, 2));
}

export async function loadPreviewRecord(id: string): Promise<PreviewRecord | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const base = process.env.BLOB_PUBLIC_BASE_URL || "";
    const urls = [
      base ? `${base.replace(/\/$/, "")}/world-creator/previews/${id}.json` : "",
      `https://blob.vercel-storage.com/world-creator/previews/${id}.json`,
    ].filter(Boolean);
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return (await res.json()) as PreviewRecord;
      } catch {
        /* try next */
      }
    }
    try {
      const { list } = await import("@vercel/blob");
      const listed = await list({ prefix: `world-creator/previews/${id}.json`, token });
      const hit = listed.blobs[0];
      if (hit) {
        const res = await fetch(hit.url, { cache: "no-store" });
        if (res.ok) return (await res.json()) as PreviewRecord;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(await readFile(localPath(id), "utf8")) as PreviewRecord;
  } catch {
    return null;
  }
}

export async function putGlb(id: string, version: number, glb: Buffer): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`world-creator/glb/${id}/v${version}.glb`, glb, {
      access: "public",
      addRandomSuffix: false,
      token,
      contentType: "model/gltf-binary",
    });
    return blob.url;
  }
  const { saveBuffer } = await import("../ingest/images");
  const key = `glb/${id}/v${version}.glb`;
  await saveBuffer(key, glb);
  const { fileUrl } = await import("../ids");
  return fileUrl(key);
}
