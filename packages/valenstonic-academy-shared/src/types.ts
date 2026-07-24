export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AssetKind = "ingredient" | "tool" | "vessel" | "surface" | "garnish" | "other";
export type ModelType = "procedural" | "glb";
export type ActionKind =
  | "pour"
  | "shake"
  | "stir"
  | "strain"
  | "add_ice"
  | "garnish"
  | "measure"
  | "place"
  | "custom";

export type ColliderDef = {
  type: "box" | "cylinder" | "sphere";
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
};

export type SpawnDef = {
  x: number;
  y: number;
  z: number;
  rotY?: number;
};

export type AssetRow = {
  id: string;
  slug: string;
  name: string;
  kind: AssetKind;
  model_type: ModelType;
  procedural_key: string | null;
  glb_url: string | null;
  collider: ColliderDef;
  spawn: SpawnDef;
  meta: Record<string, JsonValue>;
  created_at: Date;
  updated_at: Date;
};

export type ToolRow = {
  id: string;
  slug: string;
  name: string;
  asset_id: string | null;
  enabled_actions: string[];
  meta: Record<string, JsonValue>;
  created_at: Date;
  updated_at: Date;
};

export type ActionRow = {
  id: string;
  slug: string;
  name: string;
  kind: ActionKind;
  params_schema: Record<string, JsonValue>;
  ui_hint: string | null;
  created_at: Date;
  updated_at: Date;
};

export type RecipeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  created_at: Date;
  updated_at: Date;
};

export type RecipeStepRow = {
  id: string;
  recipe_id: string;
  step_order: number;
  title: string;
  action_slug: string;
  required_tool_slug: string | null;
  required_asset_slugs: string[];
  target_vessel_slug: string | null;
  params: Record<string, JsonValue>;
  success_message: string | null;
  failure_message: string | null;
};

export type InteractiveSceneRow = {
  id: string;
  slug: string;
  name: string;
  recipe_id: string;
  environment_key: string;
  available_asset_slugs: string[];
  available_tool_slugs: string[];
  created_at: Date;
  updated_at: Date;
};

export type CourseRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  created_at: Date;
  updated_at: Date;
};

export type CourseLessonRow = {
  id: string;
  course_id: string;
  lesson_order: number;
  title: string;
  kind: "text" | "interactive";
  body: string | null;
  interactive_scene_id: string | null;
};

export type PracticePayload = {
  scene: InteractiveSceneRow;
  recipe: RecipeRow;
  steps: RecipeStepRow[];
  assets: AssetRow[];
  tools: ToolRow[];
  actions: ActionRow[];
};
