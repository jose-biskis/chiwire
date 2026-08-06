export type McpGlobalSettings = {
  authSecret: string | null;
  allowedOrigin: string | null;
};

export type TrelloWorkspaceCredentials = {
  id: string;
  displayName: string | null;
  apiKey: string;
  token: string;
  enabled: boolean;
};

export const REDIS_SETTINGS_KEY = "chiwire:mcps:settings";
export const REDIS_WORKSPACE_KEY_PREFIX = "chiwire:mcps:trello:workspace:";
export const REDIS_WORKSPACE_INDEX_KEY = "chiwire:mcps:trello:workspaces";

export function workspaceRedisKey(workspaceId: string): string {
  return `${REDIS_WORKSPACE_KEY_PREFIX}${workspaceId}`;
}
