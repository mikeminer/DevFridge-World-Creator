import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { IMAGE_MAX_BYTES } from "../config";

export const ACCEPTED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateImage(buf: Buffer): { ok: true; mime: string } | { ok: false; error: string } {
  if (buf.length === 0) return { ok: false, error: "empty file" };
  if (buf.length > IMAGE_MAX_BYTES) {
    return { ok: false, error: `file exceeds ${IMAGE_MAX_BYTES} bytes` };
  }
  const mime = sniffMime(buf);
  if (!mime || !ACCEPTED_MIME.has(mime)) {
    return { ok: false, error: "only PNG, JPEG, or WEBP images are accepted" };
  }
  return { ok: true, mime };
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function storagePath(key: string): string {
  return join(process.cwd(), "data", "storage", key);
}

export async function saveBuffer(key: string, buf: Buffer): Promise<void> {
  const path = storagePath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}

export async function readBuffer(key: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(storagePath(key));
}

export function toDataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
