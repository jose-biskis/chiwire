import type { Knex } from "knex";
import type { FileChecksum } from "./checksum.js";

/** Control schema for migration history (not the app target schema). */
export const HISTORY_SCHEMA = "chiwire";
export const HISTORY_TABLE = "schema_history";

export type HistoryRow = {
  id: number;
  target_schema: string;
  checksum: string;
  files: FileChecksum[];
  applied_at: Date;
  success: boolean;
  execution_time_ms: number | null;
  error: string | null;
};

export async function ensureHistoryTable(db: Knex): Promise<void> {
  await db.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [HISTORY_SCHEMA]);

  const exists = await db.schema
    .withSchema(HISTORY_SCHEMA)
    .hasTable(HISTORY_TABLE);

  if (exists) {
    return;
  }

  await db.schema.withSchema(HISTORY_SCHEMA).createTable(HISTORY_TABLE, (table) => {
    table.bigIncrements("id").primary();
    table.text("target_schema").notNullable();
    table.text("checksum").notNullable();
    table.jsonb("files").notNullable();
    table.timestamp("applied_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    table.boolean("success").notNullable();
    table.integer("execution_time_ms").nullable();
    table.text("error").nullable();
    table.index(["target_schema", "id"]);
  });
}

function historyQuery(db: Knex): Knex.QueryBuilder {
  return db.withSchema(HISTORY_SCHEMA).table(HISTORY_TABLE);
}

export async function getLatestHistory(
  db: Knex,
  targetSchema: string
): Promise<HistoryRow | null> {
  const row = await historyQuery(db)
    .where({ target_schema: targetSchema })
    .orderBy("id", "desc")
    .first();

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    target_schema: String(row.target_schema),
    checksum: String(row.checksum),
    files: row.files as FileChecksum[],
    applied_at: new Date(row.applied_at),
    success: Boolean(row.success),
    execution_time_ms:
      row.execution_time_ms === null || row.execution_time_ms === undefined
        ? null
        : Number(row.execution_time_ms),
    error: row.error === null || row.error === undefined ? null : String(row.error)
  };
}

export async function insertHistory(
  db: Knex,
  input: {
    targetSchema: string;
    checksum: string;
    files: FileChecksum[];
    success: boolean;
    executionTimeMs: number;
    error?: string;
  }
): Promise<void> {
  const row: Record<string, unknown> = {
    target_schema: input.targetSchema,
    checksum: input.checksum,
    files: db.raw("?::jsonb", [JSON.stringify(input.files)]),
    success: input.success,
    execution_time_ms: input.executionTimeMs
  };

  if (input.error !== undefined) {
    row.error = input.error;
  }

  await historyQuery(db).insert(row);
}
