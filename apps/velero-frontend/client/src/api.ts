import type { HarborManifest, LogLine, WatchProfile, WatchStatus } from "./types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export function fetchStatus(): Promise<WatchStatus> {
  return request<WatchStatus>("/api/status");
}

export async function fetchProfiles(): Promise<WatchProfile[]> {
  const payload = await request<{ profiles: WatchProfile[] }>("/api/profiles");
  return payload.profiles;
}

export async function saveProfile(
  draft: Record<string, unknown>,
  id?: string
): Promise<WatchProfile> {
  const payload = await request<{ profile: WatchProfile }>(
    id ? `/api/profiles/${id}` : "/api/profiles",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(draft)
    }
  );
  return payload.profile;
}

export function deleteProfile(id: string): Promise<{ ok: boolean }> {
  return request(`/api/profiles/${id}`, { method: "DELETE" });
}

export async function startWatch(profileId: string): Promise<WatchStatus> {
  const payload = await request<{ status: WatchStatus }>("/api/watch/start", {
    method: "POST",
    body: JSON.stringify({ profileId })
  });
  return payload.status;
}

export async function stopWatch(): Promise<WatchStatus> {
  const payload = await request<{ status: WatchStatus }>("/api/watch/stop", {
    method: "POST",
    body: JSON.stringify({})
  });
  return payload.status;
}

export async function fetchLogs(limit = 400): Promise<LogLine[]> {
  const payload = await request<{ lines: LogLine[] }>(`/api/logs?limit=${limit}`);
  return payload.lines;
}

export async function fetchHarborManifest(): Promise<HarborManifest> {
  const response = await fetch("/downloads/manifest.json", { cache: "no-store" });
  if (!response.ok) {
    return {
      productName: "Velero Harbor",
      version: "0.1.0",
      publishedAt: null,
      artifacts: []
    };
  }
  return (await response.json()) as HarborManifest;
}
