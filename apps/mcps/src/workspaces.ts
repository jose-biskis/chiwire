import process from "node:process";

import {
  getSettings,
  getWorkspace,
  listWorkspaceIds,
  type TrelloWorkspaceCredentials,
} from "@chiwire/mcps-config";
import type { Knex } from "knex";

const TOKEN_ENV_PREFIX = "TRELLO_TOKEN_";
const API_KEY_ENV_PREFIX = "TRELLO_API_KEY_";

export type TrelloWorkspace = {
  id: string;
  apiKey: string;
  token: string;
};

export type TrelloWorkspaceRegistry = {
  workspaces: Map<string, TrelloWorkspace>;
  /** Set only when exactly one workspace is configured (tool default). */
  soleWorkspaceId: string | undefined;
  authSecret: string | undefined;
  allowedOrigin: string | undefined;
  source: "database" | "env";
};

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  return values.find((value) => value !== undefined && value !== null && value.trim() !== "")?.trim();
}

function normalizeWorkspaceId(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

function workspaceIdFromEnvSuffix(suffix: string): string {
  return normalizeWorkspaceId(suffix);
}

function loadEnvWorkspaces(env: NodeJS.ProcessEnv = process.env): Map<string, TrelloWorkspace> {
  const workspaces = new Map<string, TrelloWorkspace>();
  const sharedApiKey = firstNonEmpty(env.TRELLO_API_KEY);

  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith(TOKEN_ENV_PREFIX) || !value || value.trim() === "") {
      continue;
    }

    const id = workspaceIdFromEnvSuffix(name.slice(TOKEN_ENV_PREFIX.length));
    if (!id) {
      continue;
    }

    const suffix = name.slice(TOKEN_ENV_PREFIX.length);
    const apiKey = firstNonEmpty(env[`${API_KEY_ENV_PREFIX}${suffix}`], sharedApiKey) ?? "";

    workspaces.set(id, {
      id,
      apiKey,
      token: value.trim(),
    });
  }

  const workspaceKeyPattern = /^TRELLO_([A-Z0-9_]+)_API_KEY$/;
  for (const [name, value] of Object.entries(env)) {
    const match = workspaceKeyPattern.exec(name);
    if (!match || !value?.trim()) {
      continue;
    }

    const raw = match[1];
    if (!raw || raw === "DEFAULT") {
      continue;
    }

    const id = normalizeWorkspaceId(raw);
    const token = firstNonEmpty(env[`TRELLO_${raw}_TOKEN`]);
    if (!token) {
      continue;
    }

    workspaces.set(id, {
      id,
      apiKey: value.trim(),
      token,
    });
  }

  const legacyToken = firstNonEmpty(env.TRELLO_TOKEN);
  if (legacyToken && sharedApiKey && !workspaces.has("default")) {
    workspaces.set("default", {
      id: "default",
      apiKey: sharedApiKey,
      token: legacyToken,
    });
  }

  return workspaces;
}

function credentialsToWorkspace(credentials: TrelloWorkspaceCredentials): TrelloWorkspace {
  return {
    id: credentials.id,
    apiKey: credentials.apiKey,
    token: credentials.token,
  };
}

function soleWorkspaceId(workspaces: Map<string, TrelloWorkspace>): string | undefined {
  return workspaces.size === 1 ? [...workspaces.keys()][0] : undefined;
}

/**
 * Load workspace credentials from Redis/Postgres when configured, otherwise env.
 *
 * Env shapes supported:
 * - `TRELLO_<WS>_API_KEY` + `TRELLO_<WS>_TOKEN`
 * - `TRELLO_TOKEN_<WS>` with optional `TRELLO_API_KEY_<WS>` or shared `TRELLO_API_KEY`
 */
export async function loadTrelloWorkspaceRegistry(
  db: Knex | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TrelloWorkspaceRegistry> {
  if (db) {
    const settings = await getSettings(db);
    const ids = await listWorkspaceIds(db);
    const workspaces = new Map<string, TrelloWorkspace>();

    for (const id of ids) {
      const credentials = await getWorkspace(db, id);
      if (credentials) {
        workspaces.set(id, credentialsToWorkspace(credentials));
      }
    }

    if (workspaces.size === 0) {
      for (const [id, workspace] of loadEnvWorkspaces(env)) {
        workspaces.set(id, workspace);
      }
    }

    return {
      workspaces,
      soleWorkspaceId: soleWorkspaceId(workspaces),
      // Garita/DB is source of truth when set; deploy env is only a bootstrap fallback.
      authSecret: firstNonEmpty(settings.authSecret, env.MCP_AUTH_SECRET),
      allowedOrigin: firstNonEmpty(settings.allowedOrigin, env.MCP_ALLOWED_ORIGIN),
      source: workspaces.size > 0 && ids.length > 0 ? "database" : "env",
    };
  }

  const workspaces = loadEnvWorkspaces(env);

  return {
    workspaces,
    soleWorkspaceId: soleWorkspaceId(workspaces),
    authSecret: firstNonEmpty(env.MCP_AUTH_SECRET),
    allowedOrigin: firstNonEmpty(env.MCP_ALLOWED_ORIGIN),
    source: "env",
  };
}

export function listConfiguredWorkspaceIds(registry: TrelloWorkspaceRegistry): string[] {
  return [...registry.workspaces.keys()].sort();
}
