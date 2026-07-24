/**
 * Split a SQL script into statements, respecting -- comments, 'strings',
 * and dollar-quoted bodies ($$ ... $$ / $tag$ ... $tag$).
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let dollarTag: string | null = null;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      statements.push(trimmed);
    }
    current = "";
  };

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") {
        inLineComment = false;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += "/";
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (dollarTag !== null) {
      current += ch;
      if (ch === "$" && sql.startsWith(dollarTag, i)) {
        current += dollarTag.slice(1);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += "'";
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
      }
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      current += ch;
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      current += ch;
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      current += ch;
      inSingleQuote = true;
      i += 1;
      continue;
    }

    if (ch === "$") {
      const tagMatch = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ";") {
      push();
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  push();
  return statements;
}
