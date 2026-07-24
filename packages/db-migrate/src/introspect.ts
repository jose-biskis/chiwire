import type { Knex } from "knex";

export type LiveColumn = {
  name: string;
  /** format_type(atttypid, atttypmod) */
  formatType: string;
  notNull: boolean;
  defaultSql: string | null;
};

export type LiveTable = {
  schema: string;
  name: string;
  columns: LiveColumn[];
};

export async function listTablesInSchema(
  db: Knex,
  schema: string
): Promise<string[]> {
  const result = await db.raw(
    `
    SELECT c.relname AS name
    FROM pg_class AS c
    INNER JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = ?
      AND c.relkind = 'r'
    ORDER BY c.relname
    `,
    [schema]
  );

  return (result.rows as Array<{ name: string }>).map((row) => row.name);
}

export async function introspectTable(
  db: Knex,
  schema: string,
  table: string
): Promise<LiveTable | null> {
  const result = await db.raw(
    `
    SELECT
      a.attname AS name,
      format_type(a.atttypid, a.atttypmod) AS format_type,
      a.attnotnull AS not_null,
      pg_get_expr(ad.adbin, ad.adrelid) AS default_sql
    FROM pg_attribute AS a
    INNER JOIN pg_class AS c ON c.oid = a.attrelid
    INNER JOIN pg_namespace AS n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef AS ad
      ON ad.adrelid = a.attrelid
     AND ad.adnum = a.attnum
    WHERE n.nspname = ?
      AND c.relname = ?
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
    `,
    [schema, table]
  );

  const rows = result.rows as Array<{
    name: string;
    format_type: string;
    not_null: boolean;
    default_sql: string | null;
  }>;

  if (rows.length === 0) {
    const tables = await listTablesInSchema(db, schema);
    if (!tables.includes(table)) {
      return null;
    }
  }

  // Empty table (no columns) shouldn't happen for relkind r, but treat as missing.
  if (rows.length === 0) {
    return null;
  }

  return {
    schema,
    name: table,
    columns: rows.map((row) => ({
      name: row.name,
      formatType: row.format_type,
      notNull: row.not_null,
      defaultSql: row.default_sql
    }))
  };
}

/** Normalize a SQL type string through Postgres to format_type(...). */
export async function normalizeTypeSql(
  db: Knex,
  typeSql: string
): Promise<string> {
  const result = await db.raw(
    `
    SELECT CASE
      WHEN to_regtype(?) IS NULL THEN NULL
      ELSE format_type(to_regtype(?), NULL)
    END AS format_type
    `,
    [typeSql, typeSql]
  );

  const formatType = (result.rows as Array<{ format_type: string | null }>)[0]
    ?.format_type;
  if (!formatType) {
    throw new Error(`Unknown Postgres type: ${typeSql}`);
  }
  return formatType;
}
