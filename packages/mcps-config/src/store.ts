import type { Knex } from "knex";

import { settingsTable, trelloWorkspacesTable } from "./db.js";
import { connectRedis } from "./redis.js";
import {
  REDIS_SETTINGS_KEY,
  REDIS_WORKSPACE_INDEX_KEY,
  type McpGlobalSettings,
  type TrelloWorkspaceCredentials,
  workspaceRedisKey,
} from "./types.js";

type WorkspaceRow = {
  id: string;
  display_name: string | null;
  api_key: string;
  token: string;
  enabled: boolean;
};

type SettingsRow = {
  auth_secret: string | null;
  allowed_origin: string | null;
};

function mapWorkspace(row: WorkspaceRow): TrelloWorkspaceCredentials {
  return {
    id: row.id,
    displayName: row.display_name,
    apiKey: row.api_key,
    token: row.token,
    enabled: row.enabled,
  };
}

function mapSettings(row: SettingsRow | undefined): McpGlobalSettings {
  return {
    authSecret: row?.auth_secret ?? null,
    allowedOrigin: row?.allowed_origin ?? null,
  };
}

async function cacheSettings(settings: McpGlobalSettings): Promise<void> {
  const redis = await connectRedis().catch(() => null);
  if (!redis) {
    return;
  }

  await redis.set(REDIS_SETTINGS_KEY, JSON.stringify(settings));
}

async function cacheWorkspace(workspace: TrelloWorkspaceCredentials): Promise<void> {
  const redis = await connectRedis().catch(() => null);
  if (!redis) {
    return;
  }

  const pipeline = redis.pipeline();
  pipeline.set(workspaceRedisKey(workspace.id), JSON.stringify(workspace));
  if (workspace.enabled) {
    pipeline.sadd(REDIS_WORKSPACE_INDEX_KEY, workspace.id);
  } else {
    pipeline.srem(REDIS_WORKSPACE_INDEX_KEY, workspace.id);
  }
  await pipeline.exec();
}

export async function readSettingsFromDb(db: Knex): Promise<McpGlobalSettings> {
  const row = (await settingsTable(db).where({ id: 1 }).first()) as SettingsRow | undefined;
  return mapSettings(row);
}

export async function readWorkspaceFromDb(
  db: Knex,
  workspaceId: string,
): Promise<TrelloWorkspaceCredentials | null> {
  const row = (await trelloWorkspacesTable(db).where({ id: workspaceId }).first()) as
    | WorkspaceRow
    | undefined;
  return row ? mapWorkspace(row) : null;
}

export async function listWorkspacesFromDb(db: Knex): Promise<TrelloWorkspaceCredentials[]> {
  const rows = (await trelloWorkspacesTable(db).orderBy("id", "asc")) as WorkspaceRow[];
  return rows.map(mapWorkspace);
}

export async function getSettings(db: Knex | null): Promise<McpGlobalSettings> {
  const redis = await connectRedis().catch(() => null);
  if (redis) {
    const cached = await redis.get(REDIS_SETTINGS_KEY);
    if (cached) {
      return JSON.parse(cached) as McpGlobalSettings;
    }
  }

  if (!db) {
    return mapSettings(undefined);
  }

  const settings = await readSettingsFromDb(db);
  await cacheSettings(settings);
  return settings;
}

export async function getWorkspace(
  db: Knex | null,
  workspaceId: string,
): Promise<TrelloWorkspaceCredentials | null> {
  const redis = await connectRedis().catch(() => null);
  if (redis) {
    const cached = await redis.get(workspaceRedisKey(workspaceId));
    if (cached) {
      const workspace = JSON.parse(cached) as TrelloWorkspaceCredentials;
      return workspace.enabled ? workspace : null;
    }
  }

  if (!db) {
    return null;
  }

  const workspace = await readWorkspaceFromDb(db, workspaceId);
  if (workspace) {
    await cacheWorkspace(workspace);
  }

  return workspace?.enabled ? workspace : null;
}

export async function listWorkspaceIds(db: Knex | null): Promise<string[]> {
  const redis = await connectRedis().catch(() => null);
  if (redis) {
    const cached = await redis.smembers(REDIS_WORKSPACE_INDEX_KEY);
    if (cached.length > 0) {
      return cached.sort();
    }
  }

  if (!db) {
    return [];
  }

  const workspaces = await listWorkspacesFromDb(db);
  const enabled = workspaces.filter((workspace) => workspace.enabled);

  if (redis && enabled.length > 0) {
    const pipeline = redis.pipeline();
    pipeline.del(REDIS_WORKSPACE_INDEX_KEY);
    for (const workspace of enabled) {
      pipeline.set(workspaceRedisKey(workspace.id), JSON.stringify(workspace));
      pipeline.sadd(REDIS_WORKSPACE_INDEX_KEY, workspace.id);
    }
    await pipeline.exec();
  }

  return enabled.map((workspace) => workspace.id).sort();
}

export async function warmConfigCache(db: Knex): Promise<void> {
  const settings = await readSettingsFromDb(db);
  await cacheSettings(settings);

  const workspaces = await listWorkspacesFromDb(db);
  const redis = await connectRedis().catch(() => null);
  if (!redis) {
    return;
  }

  const pipeline = redis.pipeline();
  pipeline.del(REDIS_WORKSPACE_INDEX_KEY);
  for (const workspace of workspaces) {
    pipeline.set(workspaceRedisKey(workspace.id), JSON.stringify(workspace));
    if (workspace.enabled) {
      pipeline.sadd(REDIS_WORKSPACE_INDEX_KEY, workspace.id);
    }
  }
  await pipeline.exec();
}

export async function upsertSettings(
  db: Knex,
  settings: McpGlobalSettings,
): Promise<McpGlobalSettings> {
  await settingsTable(db)
    .insert({
      id: 1,
      auth_secret: settings.authSecret,
      allowed_origin: settings.allowedOrigin,
      updated_at: db.fn.now(),
    })
    .onConflict("id")
    .merge({
      auth_secret: settings.authSecret,
      allowed_origin: settings.allowedOrigin,
      updated_at: db.fn.now(),
    });

  const saved = await readSettingsFromDb(db);
  await cacheSettings(saved);
  return saved;
}

export async function upsertWorkspace(
  db: Knex,
  workspace: TrelloWorkspaceCredentials,
): Promise<TrelloWorkspaceCredentials> {
  await trelloWorkspacesTable(db)
    .insert({
      id: workspace.id,
      display_name: workspace.displayName,
      api_key: workspace.apiKey,
      token: workspace.token,
      enabled: workspace.enabled,
      updated_at: db.fn.now(),
    })
    .onConflict("id")
    .merge({
      display_name: workspace.displayName,
      api_key: workspace.apiKey,
      token: workspace.token,
      enabled: workspace.enabled,
      updated_at: db.fn.now(),
    });

  const saved = await readWorkspaceFromDb(db, workspace.id);
  if (!saved) {
    throw new Error(`Failed to persist workspace ${workspace.id}`);
  }

  await cacheWorkspace(saved);
  return saved;
}

export async function deleteWorkspace(db: Knex, workspaceId: string): Promise<void> {
  await trelloWorkspacesTable(db).where({ id: workspaceId }).del();

  const redis = await connectRedis().catch(() => null);
  if (!redis) {
    return;
  }

  await redis
    .pipeline()
    .del(workspaceRedisKey(workspaceId))
    .srem(REDIS_WORKSPACE_INDEX_KEY, workspaceId)
    .exec();
}

/** Public API shape for Garita list views (secrets masked). */
export function maskWorkspace(workspace: TrelloWorkspaceCredentials): {
  id: string;
  displayName: string | null;
  apiKeyPreview: string;
  tokenPreview: string;
  enabled: boolean;
} {
  return {
    id: workspace.id,
    displayName: workspace.displayName,
    apiKeyPreview: maskSecret(workspace.apiKey),
    tokenPreview: maskSecret(workspace.token),
    enabled: workspace.enabled,
  };
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
