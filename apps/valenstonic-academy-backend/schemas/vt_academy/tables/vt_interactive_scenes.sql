CREATE TABLE IF NOT EXISTS vt_academy.vt_interactive_scenes (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  recipe_id text NOT NULL REFERENCES vt_academy.vt_recipes (id) ON DELETE CASCADE,
  environment_key text NOT NULL DEFAULT 'bar_counter',
  available_asset_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  available_tool_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
