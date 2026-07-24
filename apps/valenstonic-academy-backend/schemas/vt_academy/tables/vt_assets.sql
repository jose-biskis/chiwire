CREATE TABLE IF NOT EXISTS vt_academy.vt_assets (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL,
  model_type text NOT NULL DEFAULT 'procedural',
  procedural_key text,
  glb_url text,
  collider jsonb NOT NULL DEFAULT '{}'::jsonb,
  spawn jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
