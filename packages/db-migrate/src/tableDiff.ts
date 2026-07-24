import type { Knex } from "knex";
import { introspectTable } from "./introspect.js";
import type { DesiredColumn, DesiredTable } from "./parseTables.js";

export type AddColumnChange = {
  schema: string;
  table: string;
  column: DesiredColumn;
  sql: string;
};

export type TableDiffConflict = {
  schema: string;
  table: string;
  column?: string;
  reason: string;
};

export type TableDiffPlan = {
  createTables: DesiredTable[];
  addColumns: AddColumnChange[];
  conflicts: TableDiffConflict[];
  statements: string[];
};

function quoteIdent(ident: string): string {
  return `"${ident.replaceAll('"', '""')}"`;
}

function qualify(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

export function buildAddColumnSql(
  schema: string,
  table: string,
  column: DesiredColumn
): string {
  const parts = [
    `ALTER TABLE ${qualify(schema, table)} ADD COLUMN ${quoteIdent(column.name)} ${column.typeSql}`
  ];
  if (column.defaultSql) {
    parts.push(`DEFAULT ${column.defaultSql}`);
  }
  if (column.notNull) {
    parts.push("NOT NULL");
  }
  if (column.extraSql) {
    parts.push(column.extraSql);
  }
  return parts.join(" ");
}

async function assertTypesCompatible(
  db: Knex,
  desiredTypeSql: string,
  liveFormatType: string
): Promise<string | null> {
  const result = await db.raw(
    `
    SELECT
      to_regtype(?) AS desired_oid,
      to_regtype(?) AS live_oid
    `,
    [desiredTypeSql, liveFormatType]
  );

  const row = (
    result.rows as Array<{
      desired_oid: string | null;
      live_oid: string | null;
    }>
  )[0];

  if (!row?.desired_oid) {
    return `Unknown Postgres type: ${desiredTypeSql}`;
  }
  if (!row.live_oid) {
    return `Cannot resolve live type: ${liveFormatType}`;
  }
  if (String(row.desired_oid) !== String(row.live_oid)) {
    return (
      `Type mismatch: desired "${desiredTypeSql}" vs live "${liveFormatType}". ` +
      `Type changes are not allowed in v1.`
    );
  }

  const desiredTypmod = desiredTypeSql.match(/\(([^)]+)\)/);
  const liveTypmod = liveFormatType.match(/\(([^)]+)\)/);
  if (desiredTypmod && liveTypmod && desiredTypmod[1] !== liveTypmod[1]) {
    return (
      `Type modifier mismatch: desired "${desiredTypeSql}" vs live "${liveFormatType}". ` +
      `Type changes are not allowed in v1.`
    );
  }

  return null;
}

/**
 * Diff desired CREATE TABLE definitions against live Postgres.
 * Supports: create missing tables, add missing columns.
 * Conflicts (no force): extra live columns, type mismatch, nullability mismatch.
 */
export async function planTableDiff(
  db: Knex,
  desiredTables: DesiredTable[]
): Promise<TableDiffPlan> {
  const createTables: DesiredTable[] = [];
  const addColumns: AddColumnChange[] = [];
  const conflicts: TableDiffConflict[] = [];

  for (const desired of desiredTables) {
    const live = await introspectTable(db, desired.schema, desired.name);

    if (!live) {
      createTables.push(desired);
      continue;
    }

    const liveByName = new Map(live.columns.map((col) => [col.name, col]));
    const desiredNames = new Set(desired.columns.map((col) => col.name));

    for (const liveCol of live.columns) {
      if (!desiredNames.has(liveCol.name)) {
        conflicts.push({
          schema: desired.schema,
          table: desired.name,
          column: liveCol.name,
          reason:
            `Column exists in database but not in desired state. ` +
            `Drops are not allowed in v1 (no force/repair).`
        });
      }
    }

    for (const column of desired.columns) {
      const liveCol = liveByName.get(column.name);
      if (!liveCol) {
        addColumns.push({
          schema: desired.schema,
          table: desired.name,
          column,
          sql: buildAddColumnSql(desired.schema, desired.name, column)
        });
        continue;
      }

      const typeConflict = await assertTypesCompatible(
        db,
        column.typeSql,
        liveCol.formatType
      );
      if (typeConflict) {
        conflicts.push({
          schema: desired.schema,
          table: desired.name,
          column: column.name,
          reason: typeConflict
        });
      }

      if (column.notNull !== liveCol.notNull) {
        conflicts.push({
          schema: desired.schema,
          table: desired.name,
          column: column.name,
          reason:
            `Nullability mismatch: desired notNull=${column.notNull} ` +
            `vs live notNull=${liveCol.notNull}. Nullability changes are not allowed in v1.`
        });
      }
    }
  }

  const statements = [
    ...createTables.map((table) => table.createStatement),
    ...addColumns.map((change) => change.sql)
  ];

  return { createTables, addColumns, conflicts, statements };
}

export function formatTableDiffConflicts(conflicts: TableDiffConflict[]): string {
  return conflicts
    .map((conflict) => {
      const target = conflict.column
        ? `${conflict.schema}.${conflict.table}.${conflict.column}`
        : `${conflict.schema}.${conflict.table}`;
      return `- ${target}: ${conflict.reason}`;
    })
    .join("\n");
}
