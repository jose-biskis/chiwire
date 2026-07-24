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
