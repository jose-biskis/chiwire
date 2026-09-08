import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { app } from "electron";
import {
  asSubagentRunMode,
  DEFAULT_SETTINGS,
  type AgentSettings,
  type McpServerConfig,
  type OllamaMode
} from "../shared/types.js";

/** Stable folder name — scoped package name / productName would otherwise split userData. */
export const APP_USER_DIR = "cachicamo-coding-agent-local";
const SETTINGS_FILE = "cachicamo-coding-agent-local-settings.json";

export function ensureAppIdentity(): void {
  app.setName(APP_USER_DIR);
  if (process.platform === "win32") {
    app.setAppUserModelId(`com.chiwire.${APP_USER_DIR}`);
  }
}

function newApiToken(): string {
  return randomBytes(24).toString("hex");
}

function asOllamaMode(value: unknown): OllamaMode {
  return value === "cloud" ? "cloud" : "local";
}

export function settingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE);
}

function legacySettingsPaths(): string[] {
  const home = homedir();
  const file = SETTINGS_FILE;
  return [
    join(home, ".config", "@chiwire", "cachicamo-coding-agent-local", file),
    join(home, ".config", "Electron", file),
    join(home, ".config", "Cachicamo Coding Agent Local", file),
    join(home, ".config", "cachicamo-coding-agent-local", file)
  ];
}

function migrateLegacySettings(dest: string): void {
  if (existsSync(dest)) return;
  const destDir = dirname(dest);
  for (const candidate of legacySettingsPaths()) {
    if (candidate === dest || !existsSync(candidate)) continue;
    try {
      mkdirSync(destDir, { recursive: true });
      writeFileSync(dest, readFileSync(candidate, "utf8"), "utf8");
      console.log(`[cachicamo] Migrated settings from ${candidate}`);
      return;
    } catch (error) {
      console.warn(`[cachicamo] Could not migrate settings from ${candidate}:`, error);
    }
  }
}

function normalizeSettings(raw: Partial<AgentSettings>): AgentSettings {
  const merged: AgentSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    mode: asOllamaMode(raw.mode),
    localHost: typeof raw.localHost === "string" ? raw.localHost : DEFAULT_SETTINGS.localHost,
    cloudHost: typeof raw.cloudHost === "string" ? raw.cloudHost : DEFAULT_SETTINGS.cloudHost,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : DEFAULT_SETTINGS.apiKey,
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model : DEFAULT_SETTINGS.model,
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
      : [],
    uiArchetype: raw.uiArchetype === "valenstonic" ? "valenstonic" : "internal",
    uiColorMode: raw.uiColorMode === "light" ? "light" : "dark",
    subagentRunMode: asSubagentRunMode(raw.subagentRunMode)
  };

  if (!merged.apiToken.trim()) {
    merged.apiToken = newApiToken();
  }

  return merged;
}

function writeAtomic(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function loadSettings(): AgentSettings {
  const path = settingsPath();
  migrateLegacySettings(path);

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
  } catch (error) {
    console.error(`[cachicamo] Failed to read settings at ${path}; keeping file and using defaults.`, error);
    return normalizeSettings({});
  }
}

export function saveSettings(settings: AgentSettings): AgentSettings {
  const path = settingsPath();
  const normalized = normalizeSettings(settings);
  writeAtomic(path, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

export function apiListenChanged(previous: AgentSettings, next: AgentSettings): boolean {
  return (
    previous.apiEnabled !== next.apiEnabled ||
    previous.apiPort !== next.apiPort ||
    previous.apiToken !== next.apiToken
  );
}
