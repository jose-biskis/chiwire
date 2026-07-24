import type { Knex } from "knex";
import { checksumSchemaFiles } from "./checksum.js";
import { ensureHistoryTable, getLatestHistory, type HistoryRow } from "./history.js";
import { loadSchemaFiles, resolveSchemaDir } from "./loadSchema.js";

export type StatusOptions = {
  targetSchema: string;
  schemasRoot?: string;
};

export type SchemaStatus = {
  targetSchema: string;
  schemaDir: string;
  currentChecksum: string;
  fileCount: number;
  latest: HistoryRow | null;
  state: "never_applied" | "up_to_date" | "pending" | "failed";
};

export async function getSchemaStatus(
  db: Knex,
  options: StatusOptions
): Promise<SchemaStatus> {
  const schemaDir = resolveSchemaDir(options.targetSchema, options.schemasRoot);
  const files = await loadSchemaFiles(schemaDir);
  const { checksum } = checksumSchemaFiles(files);

  await ensureHistoryTable(db);
  const latest = await getLatestHistory(db, options.targetSchema);

  let state: SchemaStatus["state"];
  if (!latest) {
    state = "never_applied";
  } else if (!latest.success) {
    state = "failed";
  } else if (latest.checksum === checksum) {
    state = "up_to_date";
  } else {
    state = "pending";
  }

  return {
    targetSchema: options.targetSchema,
    schemaDir,
    currentChecksum: checksum,
    fileCount: files.length,
    latest,
    state
  };
}
