import assert from "node:assert/strict";
import test from "node:test";
import {
  parseColumnDefinition,
  parseCreateTableStatement,
  splitTopLevelCommas
} from "./parseTables.js";

test("splitTopLevelCommas respects typmod and defaults", () => {
  const parts = splitTopLevelCommas(
    `id text PRIMARY KEY, title varchar(32) NOT NULL, amount numeric(10, 2) DEFAULT (1 + 2)`
  );
  assert.equal(parts.length, 3);
  assert.match(parts[2]!, /numeric\(10, 2\)/);
});

test("parseColumnDefinition handles common clauses", () => {
  const column = parseColumnDefinition(
    `body text NOT NULL DEFAULT ''`
  );
  assert.ok(column);
  assert.equal(column!.name, "body");
  assert.equal(column!.typeSql, "text");
  assert.equal(column!.notNull, true);
  assert.equal(column!.defaultSql, "''");
});

test("parseCreateTableStatement reads bway.notes shape", () => {
  const table = parseCreateTableStatement(
    `
    CREATE TABLE IF NOT EXISTS bway.notes (
      id text PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )
    `,
    "bway"
  );

  assert.equal(table.schema, "bway");
  assert.equal(table.name, "notes");
  assert.equal(table.columns.length, 4);
  assert.equal(table.columns[0]!.name, "id");
  assert.equal(table.columns[0]!.notNull, true);
  assert.equal(table.columns[3]!.typeSql, "timestamptz");
  assert.equal(table.columns[3]!.defaultSql, "now()");
});

test("parseCreateTableStatement skips table constraints", () => {
  const table = parseCreateTableStatement(
    `
    CREATE TABLE bway.note_tags (
      note_id text NOT NULL REFERENCES bway.notes (id) ON DELETE CASCADE,
      tag text NOT NULL,
      PRIMARY KEY (note_id, tag)
    )
    `,
    "bway"
  );

  assert.equal(table.columns.length, 2);
  assert.equal(table.columns[0]!.name, "note_id");
  assert.equal(table.columns[0]!.notNull, true);
  assert.equal(table.columns[1]!.notNull, true);
  assert.match(table.columns[0]!.extraSql ?? "", /REFERENCES/i);
});
