import { createKnex } from "@chiwire/core";
import type { Knex } from "knex";

/** Postgres schema for Valenstonic Academy tables. */
export const SCHEMA = "vt_academy";

export function getDb(): Knex {
  return createKnex();
}

/** Query builder scoped to the academy schema. */
export function academyTable(db: Knex, tableName: string): Knex.QueryBuilder {
  return db.withSchema(SCHEMA).table(tableName);
}

export async function migrate(db: Knex): Promise<void> {
  await db.raw(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);

  const hasAssets = await db.schema.withSchema(SCHEMA).hasTable("vt_assets");
  if (hasAssets) {
    return;
  }

  const ref = (tableName: string) => `${SCHEMA}.${tableName}`;
  const create = () => db.schema.withSchema(SCHEMA);

  await create().createTable("vt_assets", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.text("kind").notNullable();
    table.text("model_type").notNullable().defaultTo("procedural");
    table.text("procedural_key").nullable();
    table.text("glb_url").nullable();
    table.jsonb("collider").notNullable().defaultTo("{}");
    table.jsonb("spawn").notNullable().defaultTo("{}");
    table.jsonb("meta").notNullable().defaultTo("{}");
    table.timestamps(true, true);
  });

  await create().createTable("vt_actions", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.text("kind").notNullable();
    table.jsonb("params_schema").notNullable().defaultTo("{}");
    table.text("ui_hint").nullable();
    table.timestamps(true, true);
  });

  await create().createTable("vt_tools", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.text("asset_id").nullable().references("id").inTable(ref("vt_assets")).onDelete("SET NULL");
    table.jsonb("enabled_actions").notNullable().defaultTo("[]");
    table.jsonb("meta").notNullable().defaultTo("{}");
    table.timestamps(true, true);
  });

  await create().createTable("vt_recipes", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.text("description").nullable();
    table.text("category").notNullable().defaultTo("cocktail");
    table.timestamps(true, true);
  });

  await create().createTable("vt_recipe_steps", (table) => {
    table.text("id").primary();
    table
      .text("recipe_id")
      .notNullable()
      .references("id")
      .inTable(ref("vt_recipes"))
      .onDelete("CASCADE");
    table.integer("step_order").notNullable();
    table.text("title").notNullable();
    table.text("action_slug").notNullable();
    table.text("required_tool_slug").nullable();
    table.jsonb("required_asset_slugs").notNullable().defaultTo("[]");
    table.text("target_vessel_slug").nullable();
    table.jsonb("params").notNullable().defaultTo("{}");
    table.text("success_message").nullable();
    table.text("failure_message").nullable();
    table.unique(["recipe_id", "step_order"]);
  });

  await create().createTable("vt_interactive_scenes", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table
      .text("recipe_id")
      .notNullable()
      .references("id")
      .inTable(ref("vt_recipes"))
      .onDelete("CASCADE");
    table.text("environment_key").notNullable().defaultTo("bar_counter");
    table.jsonb("available_asset_slugs").notNullable().defaultTo("[]");
    table.jsonb("available_tool_slugs").notNullable().defaultTo("[]");
    table.timestamps(true, true);
  });

  await create().createTable("vt_courses", (table) => {
    table.text("id").primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.text("description").nullable();
    table.text("category").notNullable().defaultTo("cocktails");
    table.timestamps(true, true);
  });

  await create().createTable("vt_course_lessons", (table) => {
    table.text("id").primary();
    table
      .text("course_id")
      .notNullable()
      .references("id")
      .inTable(ref("vt_courses"))
      .onDelete("CASCADE");
    table.integer("lesson_order").notNullable();
    table.text("title").notNullable();
    table.text("kind").notNullable();
    table.text("body").nullable();
    table
      .text("interactive_scene_id")
      .nullable()
      .references("id")
      .inTable(ref("vt_interactive_scenes"))
      .onDelete("SET NULL");
    table.unique(["course_id", "lesson_order"]);
  });
}
