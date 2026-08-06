CREATE TABLE IF NOT EXISTS mcps.trello_workspaces (
  id text PRIMARY KEY,
  display_name text,
  api_key text NOT NULL,
  token text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
