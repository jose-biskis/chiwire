export type DesiredColumn = {
  name: string;
  /** Type as written in SQL (e.g. timestamptz, varchar(32)). */
  typeSql: string;
  notNull: boolean;
  defaultSql: string | null;
  /** Remainder clauses like REFERENCES ... (for ADD COLUMN / create). */
  extraSql: string | null;
};

export type DesiredTable = {
  schema: string;
  name: string;
  /** Original CREATE TABLE statement (used when the table is missing). */
  createStatement: string;
  columns: DesiredColumn[];
};

const CREATE_TABLE_RE =
  /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(.+?)\s*\(([\s\S]*)\)\s*$/i;

const CONSTRAINT_START_RE =
  /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE)\b/i;

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function splitQualifiedName(raw: string): { schema: string | null; name: string } {
  const parts: string[] = [];
  const re = /"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    parts.push(match[1] ?? match[2]!);
  }
  if (parts.length === 1) {
    return { schema: null, name: parts[0]! };
  }
  if (parts.length === 2) {
    return { schema: parts[0]!, name: parts[1]! };
  }
  throw new Error(`Unsupported table name: ${raw}`);
}

/** Split on commas at parentheses depth 0. */
export function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingle = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];

    if (inSingle) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += "'";
        i += 1;
        continue;
      }
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  return parts;
}

function splitTopLevelWhitespace(tokens: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingle = false;

  const push = () => {
    if (current.length > 0) {
      parts.push(current);
      current = "";
    }
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const ch = tokens[i]!;
    const next = tokens[i + 1];

    if (inSingle) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += "'";
        i += 1;
        continue;
      }
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (depth === 0 && /\s/.test(ch)) {
      push();
      continue;
    }
    current += ch;
  }
  push();
  return parts;
}

function takeDefaultExpression(tokens: string[], startIndex: number): {
  defaultSql: string;
  nextIndex: number;
} {
  let depth = 0;
  const parts: string[] = [];
  let i = startIndex;

  for (; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const upper = token.toUpperCase();
    if (
      depth === 0 &&
      i > startIndex &&
      (upper === "NOT" ||
        upper === "NULL" ||
        upper === "PRIMARY" ||
        upper === "REFERENCES" ||
        upper === "UNIQUE" ||
        upper === "CHECK" ||
        upper === "COLLATE" ||
        upper === "CONSTRAINT")
    ) {
      break;
    }
    parts.push(token);
    depth += (token.match(/\(/g) ?? []).length;
    depth -= (token.match(/\)/g) ?? []).length;
  }

  return { defaultSql: parts.join(" "), nextIndex: i };
}

export function parseColumnDefinition(def: string): DesiredColumn | null {
  const trimmed = def.trim();
  if (!trimmed || CONSTRAINT_START_RE.test(trimmed)) {
    return null;
  }

  const tokens = splitTopLevelWhitespace(trimmed);
  if (tokens.length < 2) {
    throw new Error(`Cannot parse column definition: ${def}`);
  }

  const name = tokens[0]!.replace(/^"|"$/g, "");
  let i = 1;
  const typeParts: string[] = [tokens[i]!];
  i += 1;

  // Merge typmod / multi-word types until a clause keyword.
  while (i < tokens.length) {
    const upper = tokens[i]!.toUpperCase();
    if (
      upper === "NOT" ||
      upper === "NULL" ||
      upper === "DEFAULT" ||
      upper === "PRIMARY" ||
      upper === "REFERENCES" ||
      upper === "UNIQUE" ||
      upper === "CHECK" ||
      upper === "COLLATE" ||
      upper === "CONSTRAINT" ||
      upper === "GENERATED"
    ) {
      break;
    }
    if (
      (typeParts.length === 1 &&
        ["WITH", "WITHOUT", "PRECISION", "VARYING"].includes(upper)) ||
      (typeParts.join(" ").toUpperCase() === "DOUBLE" && upper === "PRECISION") ||
      (typeParts.join(" ").toUpperCase() === "CHARACTER" && upper === "VARYING") ||
      (typeParts.join(" ").toUpperCase() === "TIMESTAMP" &&
        (upper === "WITH" || upper === "WITHOUT")) ||
      (typeParts.join(" ").toUpperCase() === "TIME" &&
        (upper === "WITH" || upper === "WITHOUT")) ||
      (typeParts.join(" ").toUpperCase().endsWith("WITH") && upper === "TIME") ||
      (typeParts.join(" ").toUpperCase().endsWith("WITHOUT") && upper === "TIME") ||
      (typeParts.join(" ").toUpperCase().endsWith("TIME") && upper === "ZONE") ||
      tokens[i]!.startsWith("(")
    ) {
      typeParts.push(tokens[i]!);
      i += 1;
      continue;
    }
    if (tokens[i]!.startsWith("(") || /^[0-9]+$/.test(tokens[i]!)) {
      typeParts.push(tokens[i]!);
      i += 1;
      continue;
    }
    break;
  }

  let notNull = false;
  let defaultSql: string | null = null;
  const extraParts: string[] = [];

  while (i < tokens.length) {
    const upper = tokens[i]!.toUpperCase();
    if (upper === "NOT" && tokens[i + 1]?.toUpperCase() === "NULL") {
      notNull = true;
      i += 2;
      continue;
    }
    if (upper === "NULL") {
      i += 1;
      continue;
    }
    if (upper === "DEFAULT") {
      const taken = takeDefaultExpression(tokens, i + 1);
      defaultSql = taken.defaultSql;
      i = taken.nextIndex;
      continue;
    }
    if (upper === "PRIMARY" && tokens[i + 1]?.toUpperCase() === "KEY") {
      // PRIMARY KEY implies NOT NULL in Postgres.
      notNull = true;
      extraParts.push("PRIMARY KEY");
      i += 2;
      continue;
    }
    extraParts.push(tokens[i]!);
    i += 1;
  }

  return {
    name,
    typeSql: typeParts.join(" "),
    notNull,
    defaultSql,
    extraSql: extraParts.length > 0 ? extraParts.join(" ") : null
  };
}

/**
 * Parse a CREATE TABLE statement into a structured desired table.
 * `defaultSchema` is used when the table name is unqualified.
 */
export function parseCreateTableStatement(
  statement: string,
  defaultSchema: string
): DesiredTable {
  const cleaned = stripSqlComments(statement).trim().replace(/;?\s*$/, "");
  const match = cleaned.match(CREATE_TABLE_RE);
  if (!match) {
    throw new Error(`Not a CREATE TABLE statement: ${statement.slice(0, 80)}`);
  }

  const qualified = splitQualifiedName(match[1]!.trim());
  const schema = qualified.schema ?? defaultSchema;
  const body = match[2]!;
  const columns: DesiredColumn[] = [];
  const primaryKeyColumns = new Set<string>();

  for (const part of splitTopLevelCommas(body)) {
    const pkMatch = part
      .trim()
      .match(/^PRIMARY\s+KEY\s*\(([^)]+)\)\s*$/i);
    if (pkMatch) {
      for (const raw of splitTopLevelCommas(pkMatch[1]!)) {
        primaryKeyColumns.add(raw.trim().replace(/^"|"$/g, ""));
      }
      continue;
    }

    const column = parseColumnDefinition(part);
    if (column) {
      columns.push(column);
    }
  }

  for (const column of columns) {
    if (primaryKeyColumns.has(column.name)) {
      column.notNull = true;
    }
  }

  if (columns.length === 0) {
    throw new Error(`CREATE TABLE ${schema}.${qualified.name} has no columns`);
  }

  return {
    schema,
    name: qualified.name,
    createStatement: cleaned,
    columns
  };
}

export function isCreateTableStatement(statement: string): boolean {
  const cleaned = stripSqlComments(statement).trim();
  return /^CREATE\s+TABLE\b/i.test(cleaned);
}

function tableKey(table: DesiredTable): string {
  return `${table.schema}.${table.name}`;
}

/** Collect schema.table keys referenced via REFERENCES in a CREATE TABLE. */
export function referencedTableKeys(
  table: DesiredTable,
  defaultSchema: string
): string[] {
  const refs: string[] = [];
  const re =
    /REFERENCES\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(table.createStatement)) !== null) {
    const qualified = splitQualifiedName(match[1]!);
    const schema = qualified.schema ?? defaultSchema;
    const key = `${schema}.${qualified.name}`;
    if (key !== tableKey(table)) {
      refs.push(key);
    }
  }
  return refs;
}

/**
 * Order tables so referenced parents are created before dependents.
 * File name order no longer matters for CREATE TABLE.
 */
export function sortTablesByForeignKeys(
  tables: DesiredTable[],
  defaultSchema: string
): DesiredTable[] {
  const byKey = new Map(tables.map((table) => [tableKey(table), table]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const key of byKey.keys()) {
    indegree.set(key, 0);
    dependents.set(key, []);
  }

  for (const table of tables) {
    const key = tableKey(table);
    for (const ref of referencedTableKeys(table, defaultSchema)) {
      if (!byKey.has(ref)) {
        continue;
      }
      dependents.get(ref)!.push(key);
      indegree.set(key, (indegree.get(key) ?? 0) + 1);
    }
  }

  const ready = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));

  const ordered: DesiredTable[] = [];
  while (ready.length > 0) {
    const key = ready.shift()!;
    ordered.push(byKey.get(key)!);
    for (const dependent of dependents.get(key) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  if (ordered.length !== tables.length) {
    const remaining = [...byKey.keys()].filter(
      (key) => !ordered.some((table) => tableKey(table) === key)
    );
    throw new Error(
      `Circular foreign keys among tables: ${remaining.join(", ")}`
    );
  }

  return ordered;
}

export function classifyStatements(
  statements: string[],
  defaultSchema: string
): { tables: DesiredTable[]; otherStatements: string[] } {
  const tables: DesiredTable[] = [];
  const otherStatements: string[] = [];

  for (const statement of statements) {
    if (isCreateTableStatement(statement)) {
      tables.push(parseCreateTableStatement(statement, defaultSchema));
    } else {
      otherStatements.push(statement);
    }
  }

  return {
    tables: sortTablesByForeignKeys(tables, defaultSchema),
    otherStatements
  };
}
