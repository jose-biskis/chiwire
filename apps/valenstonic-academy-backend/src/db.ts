import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySchema } from "@chiwire/db-migrate";
import { createKnex } from "@chiwire/core";
import type { Knex } from "knex";

/** Postgres schema for Valenstonic Academy tables. */
export const SCHEMA = "vt_academy";

const schemasRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../schemas"
);

export function getDb(): Knex {
  return createKnex();
}

/** Query builder scoped to the academy schema. */
export function academyTable(db: Knex, tableName: string): Knex.QueryBuilder {
  return db.withSchema(SCHEMA).table(tableName);
}

/** Apply desired-state SQL under schemas/vt_academy via @chiwire/db-migrate. */
export async function migrate(db: Knex): Promise<void> {
  const result = await applySchema(db, {
    targetSchema: SCHEMA,
    schemasRoot
  });

  if (result.status === "up_to_date") {
    console.log(`vt_academy schema up to date (checksum ${result.checksum})`);
    return;
  }

  console.log(
    `vt_academy schema applied (checksum ${result.checksum}, ` +
      `create_tables=${result.createdTables}, add_columns=${result.addedColumns}, ` +
      `drop_columns=${result.droppedColumns})`
  );
}
