import { createHash, randomBytes, createHmac } from "node:crypto";
import { CREATOR_BASE_URL, SESSION_SECRET } from "./config";

export function uuid(): string {
  return randomBytes(16).toString("hex");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function publicIdFromSeq(seq: number): string {
  return `DFW-${String(seq).padStart(4, "0")}`;
}

export function signPreviewToken(submissionId: string, exp = Date.now() + 7 * 24 * 60 * 60 * 1000): string {
  const payload = `${submissionId}.${exp}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyPreviewToken(token: string, submissionId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, exp, sig] = parts;
  if (id !== submissionId) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", SESSION_SECRET).update(`${id}.${exp}`).digest("hex");
  return expected === sig;
}

export function previewUrl(submissionId: string): string {
  return `${CREATOR_BASE_URL}/creator/${submissionId}/preview?t=${signPreviewToken(submissionId)}`;
}

export function commitUrl(submissionId: string): string {
  return `${CREATOR_BASE_URL}/creator/${submissionId}/commit?t=${signPreviewToken(submissionId)}`;
}

export function fileUrl(storageKey: string): string {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) return storageKey;
  return `${CREATOR_BASE_URL}/api/files/${storageKey}`;
}
