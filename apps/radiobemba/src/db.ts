import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySchema } from "@chiwire/db-migrate";
import { createKnex } from "@chiwire/core";
import type { Knex } from "knex";

export const SCHEMA = "radiobemba";

const schemasRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../schemas"
);

export function getDb(): Knex {
  return createKnex();
}

export function reservationsTable(db: Knex): Knex.QueryBuilder {
  return db.withSchema(SCHEMA).table("tunnel_reservations");
}

export async function migrate(db: Knex): Promise<void> {
  const result = await applySchema(db, {
    targetSchema: SCHEMA,
    schemasRoot
  });

  if (result.status === "up_to_date") {
    console.log(`radiobemba schema up to date (checksum ${result.checksum})`);
    return;
  }

  console.log(
    `radiobemba schema applied (checksum ${result.checksum}, ` +
      `create_tables=${result.createdTables}, add_columns=${result.addedColumns})`
  );
}
