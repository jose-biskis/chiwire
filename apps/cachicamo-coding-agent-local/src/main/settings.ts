import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { DEFAULT_SETTINGS, type AgentSettings, type McpServerConfig } from "../shared/types.js";

function settingsPath(): string {
  return join(app.getPath("userData"), "cachicamo-coding-agent-local-settings.json");
}

function newApiToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeSettings(raw: Partial<AgentSettings>): AgentSettings {
  const merged: AgentSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    mcpServers: Array.isArray(raw.mcpServers)
      ? raw.mcpServers.map(
          (server): McpServerConfig => ({
            id: typeof server.id === "string" && server.id ? server.id : randomBytes(8).toString("hex"),
            name: typeof server.name === "string" ? server.name : "mcp",
            url: typeof server.url === "string" ? server.url : "",
            enabled: Boolean(server.enabled),
            ...(typeof server.bearerToken === "string" ? { bearerToken: server.bearerToken } : {}),
            ...(server.headers && typeof server.headers === "object" ? { headers: server.headers } : {})
          })
        )
      : []
  };

  if (!merged.apiToken.trim()) {
    merged.apiToken = newApiToken();
  }

  return merged;
}

export function loadSettings(): AgentSettings {
  const path = settingsPath();
  if (!existsSync(path)) {
    const fresh = normalizeSettings({});
    saveSettings(fresh);
    return fresh;
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AgentSettings>;
    const normalized = normalizeSettings(raw);
    if (!raw.apiToken?.trim()) {
      saveSettings(normalized);
    }
    return normalized;
  } catch {
    const fresh = normalizeSettings({});
    saveSettings(fresh);
    return fresh;
  }
}

export function saveSettings(settings: AgentSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  const normalized = normalizeSettings(settings);
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}
