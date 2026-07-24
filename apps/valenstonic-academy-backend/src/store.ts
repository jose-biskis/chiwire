import { createId } from "@chiwire/core";
import type {
  ActionRow,
  AssetRow,
  CourseLessonRow,
  CourseRow,
  InteractiveSceneRow,
  PracticePayload,
  RecipeRow,
  RecipeStepRow,
  ToolRow
} from "@chiwire/valenstonic-academy-shared";
import type { Knex } from "knex";
import { academyTable } from "./db.js";

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseJsonArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseJsonObject(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

export class AcademyStore {
  constructor(private readonly db: Knex) {}

  private t(tableName: string): Knex.QueryBuilder {
    return academyTable(this.db, tableName);
  }

  async listCourses(): Promise<CourseRow[]> {
    return this.t("vt_courses").orderBy("name") as Promise<CourseRow[]>;
  }

  async getCourseBySlug(slug: string): Promise<CourseRow | undefined> {
    return this.t("vt_courses").where({ slug }).first() as Promise<CourseRow | undefined>;
  }

  async listLessons(courseId: string): Promise<CourseLessonRow[]> {
    const rows = (await this.t("vt_course_lessons")
      .where({ course_id: courseId })
      .orderBy("lesson_order")) as CourseLessonRow[];
    return rows.map((row) => ({
      ...row,
      body: row.body ?? null,
      interactive_scene_id: row.interactive_scene_id ?? null
    }));
  }

  async listRecipes(): Promise<RecipeRow[]> {
    return this.t("vt_recipes").orderBy("name") as Promise<RecipeRow[]>;
  }

  async getRecipeBySlug(slug: string): Promise<RecipeRow | undefined> {
    return this.t("vt_recipes").where({ slug }).first() as Promise<RecipeRow | undefined>;
  }

  async listSteps(recipeId: string): Promise<RecipeStepRow[]> {
    const rows = (await this.t("vt_recipe_steps")
      .where({ recipe_id: recipeId })
      .orderBy("step_order")) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      recipe_id: row.recipe_id as string,
      step_order: Number(row.step_order),
      title: row.title as string,
      action_slug: row.action_slug as string,
      required_tool_slug: (row.required_tool_slug as string | null) ?? null,
      required_asset_slugs: parseJsonArray(row.required_asset_slugs),
      target_vessel_slug: (row.target_vessel_slug as string | null) ?? null,
      params: parseJsonObject(row.params) as RecipeStepRow["params"],
      success_message: (row.success_message as string | null) ?? null,
      failure_message: (row.failure_message as string | null) ?? null
    }));
  }

  async listAssets(): Promise<AssetRow[]> {
    const rows = (await this.t("vt_assets").orderBy("name")) as Record<string, unknown>[];
    return rows.map((row) => this.mapAsset(row));
  }

  async listTools(): Promise<ToolRow[]> {
    const rows = (await this.t("vt_tools").orderBy("name")) as Record<string, unknown>[];
    return rows.map((row) => this.mapTool(row));
  }

  async listActions(): Promise<ActionRow[]> {
    const rows = (await this.t("vt_actions").orderBy("name")) as Record<string, unknown>[];
    return rows.map((row) => this.mapAction(row));
  }

  async listScenes(): Promise<InteractiveSceneRow[]> {
    const rows = (await this.t("vt_interactive_scenes").orderBy(
      "name"
    )) as Record<string, unknown>[];
    return rows.map((row) => this.mapScene(row));
  }

  async getSceneBySlug(slug: string): Promise<InteractiveSceneRow | undefined> {
    const row = (await this.t("vt_interactive_scenes").where({ slug }).first()) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapScene(row) : undefined;
  }

  async getPracticeBySceneSlug(slug: string): Promise<PracticePayload | undefined> {
    const scene = await this.getSceneBySlug(slug);
    if (!scene) {
      return undefined;
    }

    const recipe = (await this.t("vt_recipes")
      .where({ id: scene.recipe_id })
      .first()) as RecipeRow | undefined;
    if (!recipe) {
      return undefined;
    }

    const steps = await this.listSteps(recipe.id);
    const assets = (await this.listAssets()).filter((asset) =>
      scene.available_asset_slugs.includes(asset.slug)
    );
    const tools = (await this.listTools()).filter((tool) =>
      scene.available_tool_slugs.includes(tool.slug)
    );
    const actionSlugs = new Set([
      ...steps.map((step) => step.action_slug),
      ...tools.flatMap((tool) => tool.enabled_actions)
    ]);
    const actions = (await this.listActions()).filter((action) => actionSlugs.has(action.slug));

    return { scene, recipe, steps, assets, tools, actions };
  }

  async upsertAsset(input: {
    id?: string;
    slug: string;
    name: string;
    kind: string;
    model_type: string;
    procedural_key?: string | null;
    glb_url?: string | null;
    collider: unknown;
    spawn: unknown;
    meta?: unknown;
  }): Promise<void> {
    const existing = await this.t("vt_assets").where({ slug: input.slug }).first();
    const payload = {
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      model_type: input.model_type,
      procedural_key: input.procedural_key ?? null,
      glb_url: input.glb_url ?? null,
      collider: JSON.stringify(input.collider ?? {}),
      spawn: JSON.stringify(input.spawn ?? {}),
      meta: JSON.stringify(input.meta ?? {}),
      updated_at: this.db.fn.now()
    };

    if (existing) {
      await this.t("vt_assets").where({ slug: input.slug }).update(payload);
      return;
    }
    await this.t("vt_assets").insert({
      id: input.id ?? createId(),
      ...payload,
      created_at: this.db.fn.now()
    });
  }

  async upsertAction(input: {
    slug: string;
    name: string;
    kind: string;
    params_schema?: unknown;
    ui_hint?: string | null;
  }): Promise<void> {
    const existing = await this.t("vt_actions").where({ slug: input.slug }).first();
    const payload = {
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      params_schema: JSON.stringify(input.params_schema ?? {}),
      ui_hint: input.ui_hint ?? null,
      updated_at: this.db.fn.now()
    };
    if (existing) {
      await this.t("vt_actions").where({ slug: input.slug }).update(payload);
      return;
    }
    await this.t("vt_actions").insert({
      id: createId(),
      ...payload,
      created_at: this.db.fn.now()
    });
  }

  /** Removes catalog actions that are no longer part of the generic verb set. */
  async deleteActionsNotIn(keepSlugs: string[]): Promise<number> {
    if (keepSlugs.length === 0) {
      return 0;
    }
    return Number(await this.t("vt_actions").whereNotIn("slug", keepSlugs).del());
  }

  async upsertTool(input: {
    slug: string;
    name: string;
    asset_id?: string | null;
    enabled_actions: string[];
    meta?: unknown;
  }): Promise<void> {
    const existing = await this.t("vt_tools").where({ slug: input.slug }).first();
    const payload = {
      slug: input.slug,
      name: input.name,
      asset_id: input.asset_id ?? null,
      enabled_actions: JSON.stringify(input.enabled_actions),
      meta: JSON.stringify(input.meta ?? {}),
      updated_at: this.db.fn.now()
    };
    if (existing) {
      await this.t("vt_tools").where({ slug: input.slug }).update(payload);
      return;
    }
    await this.t("vt_tools").insert({
      id: createId(),
      ...payload,
      created_at: this.db.fn.now()
    });
  }

  async upsertRecipe(input: {
    slug: string;
    name: string;
    description?: string | null;
    category: string;
  }): Promise<string> {
    const existing = await this.t("vt_recipes").where({ slug: input.slug }).first();
    if (existing) {
      await this.t("vt_recipes")
        .where({ slug: input.slug })
        .update({
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          updated_at: this.db.fn.now()
        });
      return existing.id as string;
    }
    const id = createId();
    await this.t("vt_recipes").insert({
      id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      created_at: this.db.fn.now(),
      updated_at: this.db.fn.now()
    });
    return id;
  }

  async replaceRecipeSteps(
    recipeId: string,
    steps: Array<{
      step_order: number;
      title: string;
      action_slug: string;
      required_tool_slug?: string | null;
      required_asset_slugs?: string[];
      target_vessel_slug?: string | null;
      params?: unknown;
      success_message?: string | null;
      failure_message?: string | null;
    }>
  ): Promise<void> {
    await this.t("vt_recipe_steps").where({ recipe_id: recipeId }).del();
    if (steps.length === 0) {
      return;
    }
    await this.t("vt_recipe_steps").insert(
      steps.map((step) => ({
        id: createId(),
        recipe_id: recipeId,
        step_order: step.step_order,
        title: step.title,
        action_slug: step.action_slug,
        required_tool_slug: step.required_tool_slug ?? null,
        required_asset_slugs: JSON.stringify(step.required_asset_slugs ?? []),
        target_vessel_slug: step.target_vessel_slug ?? null,
        params: JSON.stringify(step.params ?? {}),
        success_message: step.success_message ?? null,
        failure_message: step.failure_message ?? null
      }))
    );
  }

  async upsertScene(input: {
    slug: string;
    name: string;
    recipe_id: string;
    environment_key: string;
    available_asset_slugs: string[];
    available_tool_slugs: string[];
  }): Promise<string> {
    const existing = await this.t("vt_interactive_scenes").where({ slug: input.slug }).first();
    const payload = {
      slug: input.slug,
      name: input.name,
      recipe_id: input.recipe_id,
      environment_key: input.environment_key,
      available_asset_slugs: JSON.stringify(input.available_asset_slugs),
      available_tool_slugs: JSON.stringify(input.available_tool_slugs),
      updated_at: this.db.fn.now()
    };
    if (existing) {
      await this.t("vt_interactive_scenes").where({ slug: input.slug }).update(payload);
      return existing.id as string;
    }
    const id = createId();
    await this.t("vt_interactive_scenes").insert({
      id,
      ...payload,
      created_at: this.db.fn.now()
    });
    return id;
  }

  async upsertCourse(input: {
    slug: string;
    name: string;
    description?: string | null;
    category: string;
  }): Promise<string> {
    const existing = await this.t("vt_courses").where({ slug: input.slug }).first();
    if (existing) {
      await this.t("vt_courses")
        .where({ slug: input.slug })
        .update({
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          updated_at: this.db.fn.now()
        });
      return existing.id as string;
    }
    const id = createId();
    await this.t("vt_courses").insert({
      id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      created_at: this.db.fn.now(),
      updated_at: this.db.fn.now()
    });
    return id;
  }

  async replaceCourseLessons(
    courseId: string,
    lessons: Array<{
      lesson_order: number;
      title: string;
      kind: "text" | "interactive";
      body?: string | null;
      interactive_scene_id?: string | null;
    }>
  ): Promise<void> {
    await this.t("vt_course_lessons").where({ course_id: courseId }).del();
    if (lessons.length === 0) {
      return;
    }
    await this.t("vt_course_lessons").insert(
      lessons.map((lesson) => ({
        id: createId(),
        course_id: courseId,
        lesson_order: lesson.lesson_order,
        title: lesson.title,
        kind: lesson.kind,
        body: lesson.body ?? null,
        interactive_scene_id: lesson.interactive_scene_id ?? null
      }))
    );
  }

  private mapAsset(row: Record<string, unknown>): AssetRow {
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      kind: row.kind as AssetRow["kind"],
      model_type: row.model_type as AssetRow["model_type"],
      procedural_key: (row.procedural_key as string | null) ?? null,
      glb_url: (row.glb_url as string | null) ?? null,
      collider: parseJsonObject(row.collider) as AssetRow["collider"],
      spawn: parseJsonObject(row.spawn) as AssetRow["spawn"],
      meta: parseJsonObject(row.meta) as AssetRow["meta"],
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date
    };
  }

  private mapTool(row: Record<string, unknown>): ToolRow {
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      asset_id: (row.asset_id as string | null) ?? null,
      enabled_actions: parseJsonArray(row.enabled_actions),
      meta: parseJsonObject(row.meta) as ToolRow["meta"],
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date
    };
  }

  private mapAction(row: Record<string, unknown>): ActionRow {
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      kind: row.kind as ActionRow["kind"],
      params_schema: parseJsonObject(row.params_schema) as ActionRow["params_schema"],
      ui_hint: (row.ui_hint as string | null) ?? null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date
    };
  }

  private mapScene(row: Record<string, unknown>): InteractiveSceneRow {
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      recipe_id: row.recipe_id as string,
      environment_key: row.environment_key as string,
      available_asset_slugs: parseJsonArray(row.available_asset_slugs),
      available_tool_slugs: parseJsonArray(row.available_tool_slugs),
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date
    };
  }
}
