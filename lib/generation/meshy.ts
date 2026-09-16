import { MESHY_API_KEY } from "../config";

const BASE = "https://api.meshy.ai/openapi/v2";

export async function createMeshyTask(imageUrl: string, prompt?: string): Promise<string> {
  if (!MESHY_API_KEY) throw new Error("MESHY_API_KEY is not set");
  const res = await fetch(`${BASE}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MESHY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
      should_remesh: true,
      topology: "triangle",
      target_polycount: 40000,
      ai_model: "meshy-5",
      prompt:
        prompt ||
        "Create a stylized game-ready 3D character based on the provided reference. Preserve key visual identity, clean silhouette, no environment, no text, full character, centered, PBR, WebGL/Three.js GLB.",
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
  return { status: status === "IN_PROGRESS" ? "RUNNING" : "PENDING" };
}
