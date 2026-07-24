-- Desired state for Valenstonic Academy (schema vt_academy).

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

CREATE TABLE IF NOT EXISTS vt_academy.vt_tools (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  asset_id text REFERENCES vt_academy.vt_assets (id) ON DELETE SET NULL,
  enabled_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vt_academy.vt_recipes (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'cocktail',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vt_academy.vt_recipe_steps (
  id text PRIMARY KEY,
  recipe_id text NOT NULL REFERENCES vt_academy.vt_recipes (id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  title text NOT NULL,
  action_slug text NOT NULL,
  required_tool_slug text,
  required_asset_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_vessel_slug text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  success_message text,
  failure_message text,
  UNIQUE (recipe_id, step_order)
);

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

CREATE TABLE IF NOT EXISTS vt_academy.vt_courses (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'cocktails',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vt_academy.vt_course_lessons (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES vt_academy.vt_courses (id) ON DELETE CASCADE,
  lesson_order integer NOT NULL,
  title text NOT NULL,
  kind text NOT NULL,
  body text,
  interactive_scene_id text REFERENCES vt_academy.vt_interactive_scenes (id) ON DELETE SET NULL,
  UNIQUE (course_id, lesson_order)
);
