CREATE TABLE IF NOT EXISTS vt_academy.vt_actions (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL,
  params_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ui_hint text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
