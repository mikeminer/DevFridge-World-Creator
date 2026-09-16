import { MESHY_API_KEY } from "../config";
import { characterPrompt } from "./style";

const BASE = "https://api.meshy.ai/openapi/v1";

export function meshyAiModel(): string {
  return process.env.MESHY_AI_MODEL || "latest";
}

export async function testMeshyKey(key = MESHY_API_KEY): Promise<{ ok: boolean; detail: string }> {
  if (!key) return { ok: false, detail: "MESHY_API_KEY is empty" };
  const res = await fetch(`${BASE}/image-to-3d`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, detail: `Meshy rejected the key (${res.status})` };
  }
  return { ok: true, detail: `Meshy reachable (${res.status})` };
}

export async function createMeshyTask(
  imageDataUriOrUrl: string,
  name?: string,
  description?: string
): Promise<string> {
  if (!MESHY_API_KEY) throw new Error("MESHY_API_KEY is not set — save it in World Creator settings");
  const res = await fetch(`${BASE}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MESHY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageDataUriOrUrl,
      enable_pbr: true,
      should_remesh: true,
      should_texture: true,
      topology: "triangle",
      target_polycount: 40000,
      pose_mode: "a-pose",
      target_formats: ["glb"],
      ai_model: meshyAiModel(),
      prompt: characterPrompt(name || "", description || ""),
    }),
  });
  const body = (await res.json()) as { result?: string; message?: string };
  if (!res.ok || !body.result) {
    throw new Error(body.message || `Meshy create failed (${res.status})`);
  }
  return body.result;
}

export async function getMeshyTask(taskId: string): Promise<
  | { status: "PENDING" | "RUNNING" }
  | { status: "SUCCEEDED"; glbUrl: string; previewUrl?: string }
  | { status: "FAILED"; error: string }
> {
  const res = await fetch(`${BASE}/image-to-3d/${taskId}`, {
    headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
  });
  const body = (await res.json()) as {
    status?: string;
    model_urls?: { glb?: string };
    thumbnail_url?: string;
    task_error?: { message?: string };
  };
  const status = (body.status || "").toUpperCase();
  if (status === "SUCCEEDED" && body.model_urls?.glb) {
    return { status: "SUCCEEDED", glbUrl: body.model_urls.glb, previewUrl: body.thumbnail_url };
  }
  if (status === "FAILED" || status === "CANCELED") {
    return { status: "FAILED", error: body.task_error?.message || status };
  }
  return { status: status === "IN_PROGRESS" || status === "PROCESSING" ? "RUNNING" : "PENDING" };
}
