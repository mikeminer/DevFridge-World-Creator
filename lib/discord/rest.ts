import { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN } from "../config";

const API = "https://discord.com/api/v10";

export async function discordFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not set");
  if (!DISCORD_APPLICATION_ID && path.includes("webhooks")) {
    throw new Error("DISCORD_APPLICATION_ID is not set");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bot ${DISCORD_BOT_TOKEN}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${API}${path}`, { ...init, headers });
}

export async function editOriginal(token: string, payload: unknown): Promise<void> {
  const res = await fetch(
    `${API}/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`edit original failed ${res.status}: ${text}`);
  }
}

export async function followUp(token: string, payload: unknown): Promise<void> {
  const res = await fetch(`${API}/webhooks/${DISCORD_APPLICATION_ID}/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`follow-up failed ${res.status}: ${text}`);
  }
}

export async function postChannel(channelId: string, payload: unknown): Promise<{ id: string } | null> {
  const res = await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("postChannel", res.status, await res.text());
    return null;
  }
  return (await res.json()) as { id: string };
}

export async function dmUser(userId: string, payload: unknown): Promise<void> {
  const ch = await discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!ch.ok) return;
  const { id } = (await ch.json()) as { id: string };
  await discordFetch(`/channels/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const EPHEMERAL = 1 << 6;
export const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;
export const CHANNEL_MESSAGE_WITH_SOURCE = 4;
export const UPDATE_MESSAGE = 7;
export const MODAL = 9;
