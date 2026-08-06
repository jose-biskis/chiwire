import path from "node:path";

import { createKnex } from "@chiwire/core";
import { applySchema } from "@chiwire/db-migrate";
import type { Knex } from "knex";

export const SCHEMA = "mcps";

export function databaseConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      process.env.PGHOST?.trim() ||
      process.env.PGDATABASE?.trim(),
  );
}

export function getDb(): Knex {
  return createKnex();
}

export function settingsTable(db: Knex): Knex.QueryBuilder {
  return db.withSchema(SCHEMA).table("settings");
}

export function trelloWorkspacesTable(db: Knex): Knex.QueryBuilder {
  return db.withSchema(SCHEMA).table("trello_workspaces");
}

export async function migrateMcpsSchema(db: Knex, schemasRoot: string): Promise<void> {
  const result = await applySchema(db, {
    targetSchema: SCHEMA,
    schemasRoot: path.resolve(schemasRoot),
  });

  if (result.status === "up_to_date") {
    console.log(`mcps schema up to date (checksum ${result.checksum})`);
    return;
  }

  console.log(
    `mcps schema applied (checksum ${result.checksum}, ` +
      `create_tables=${result.createdTables}, add_columns=${result.addedColumns}, ` +
      `drop_columns=${result.droppedColumns})`,
  );
}
