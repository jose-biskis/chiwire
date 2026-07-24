import type { Knex } from "knex";
import { checksumSchemaFiles } from "./checksum.js";
import {
  ensureHistoryTable,
  getLatestHistory,
  insertHistory
} from "./history.js";
import { loadSchemaFiles, resolveSchemaDir } from "./loadSchema.js";
import { classifyStatements } from "./parseTables.js";
import { splitSqlStatements } from "./sqlSplit.js";
import {
  formatTableDiffConflicts,
  planTableDiff,
  type TableDiffPlan
} from "./tableDiff.js";

export type ApplyOptions = {
  targetSchema: string;
  schemasRoot?: string;
};

export type ApplyResult =
  | { status: "up_to_date"; checksum: string }
  | {
      status: "applied";
      checksum: string;
      statementCount: number;
      createdTables: number;
      addedColumns: number;
      executionTimeMs: number;
    };

export type PlanOptions = ApplyOptions;

async function loadDesiredSql(
  options: ApplyOptions
): Promise<{
  checksum: string;
  fileChecksums: ReturnType<typeof checksumSchemaFiles>["files"];
  statements: string[];
}> {
  const schemaDir = resolveSchemaDir(options.targetSchema, options.schemasRoot);
  const files = await loadSchemaFiles(schemaDir);
  const { checksum, files: fileChecksums } = checksumSchemaFiles(files);

  const sql = files
    .slice()
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((file) => `-- ${file.relativePath}\n${file.contents}`)
    .join("\n\n");

  return {
    checksum,
    fileChecksums,
    statements: splitSqlStatements(sql)
  };
}

/** Build a table + residual-SQL plan against the live database (no history write). */
export async function planSchema(
  db: Knex,
  options: PlanOptions
): Promise<{
  checksum: string;
  tablePlan: TableDiffPlan;
  otherStatements: string[];
  statements: string[];
}> {
  const { checksum, statements } = await loadDesiredSql(options);
  const { tables, otherStatements } = classifyStatements(
    statements,
    options.targetSchema
  );
  const tablePlan = await planTableDiff(db, tables);

  return {
    checksum,
    tablePlan,
    otherStatements,
    statements: [...tablePlan.statements, ...otherStatements]
  };
}

/**
 * Apply desired-state SQL for a target schema when the file checksum changed.
 *
 * Tables are synced via introspective diff (create missing tables / add columns).
 * Other objects (functions, etc.) are executed as written.
 *
 * Failed applies block later checksums until the same checksum is retried
 * successfully (no force/repair in v1).
 */
export async function applySchema(
  db: Knex,
  options: ApplyOptions
): Promise<ApplyResult> {
  const { checksum, fileChecksums, statements } = await loadDesiredSql(options);

  await ensureHistoryTable(db);
  const latest = await getLatestHistory(db, options.targetSchema);

  if (latest && !latest.success) {
    if (latest.checksum !== checksum) {
      throw new Error(
        `Schema "${options.targetSchema}" has a failed apply (history id ${latest.id}). ` +
          `Restore the previous desired-state files (checksum ${latest.checksum}) and retry, ` +
          `or fix the database manually so a retry of that checksum can succeed. ` +
          `Changing desired state while a failed apply is outstanding is not allowed in v1.`
      );
    }
  } else if (latest?.success && latest.checksum === checksum) {
    return { status: "up_to_date", checksum };
  }

  const { tables, otherStatements } = classifyStatements(
    statements,
    options.targetSchema
  );

  const started = Date.now();
  let startedExecuting = false;

  try {
    await db.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [options.targetSchema]);

    const tablePlan = await planTableDiff(db, tables);
    if (tablePlan.conflicts.length > 0) {
      throw new Error(
        `Table diff conflicts for schema "${options.targetSchema}":\n` +
          formatTableDiffConflicts(tablePlan.conflicts)
      );
    }

    const toRun = [...tablePlan.statements, ...otherStatements];
    startedExecuting = true;

    await db.transaction(async (trx) => {
      for (const statement of toRun) {
        await trx.raw(statement);
      }

      const executionTimeMs = Date.now() - started;
      await insertHistory(trx, {
        targetSchema: options.targetSchema,
        checksum,
        files: fileChecksums,
        success: true,
        executionTimeMs
      });
    });

    return {
      status: "applied",
      checksum,
      statementCount: toRun.length,
      createdTables: tablePlan.createTables.length,
      addedColumns: tablePlan.addColumns.length,
      executionTimeMs: Date.now() - started
    };
  } catch (error) {
    const executionTimeMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);

    // Plan/validation conflicts make no DDL changes — do not dirty history.
    if (startedExecuting) {
      await insertHistory(db, {
        targetSchema: options.targetSchema,
        checksum,
        files: fileChecksums,
        success: false,
        executionTimeMs,
        error: message
      });
    }

    throw new Error(
      `Apply failed for schema "${options.targetSchema}": ${message}`,
      { cause: error }
    );
  }
}
